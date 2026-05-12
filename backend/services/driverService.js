const { pool }       = require('../db');
const { sendMessage, sendLocation } = require('./wahaService');
const { geocode, normalizeToWaId } = require('../utils/helpers');
const cron = require('node-cron');
const t = require('./messageTemplates');

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatTime12h(timeStr) {
  if (!timeStr) return 'N/A';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour  = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateDisplay(dateStr) {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(dateStr + 'T12:00:00Z');
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} (${days[d.getUTCDay()]})`;
}

// Today's date in Riyadh timezone (UTC+3)
function getRiyadhToday() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── assignDriver ─────────────────────────────────────────────────────────────
/**
 * Assign a driver to a therapist for a given date, respecting district.
 *  1. If therapist already has an active driver for this date → reuse it.
 *  2. Find an active driver not yet assigned to anyone today.
 *  3. Fallback: all drivers taken → prefer a driver already in the same district,
 *     otherwise pick least-loaded active driver.
 * Stores the district in driver_assignments so a driver stays in one district/day.
 * Returns the driver row or null.
 */
async function assignDriver(therapistId, bookingDate, district) {
  if (!therapistId || !bookingDate) return null;

  // 1. Reuse if therapist already has an ACTIVE driver this date
  const existing = await pool.query(
    `SELECT da.*, d.name, d.phone_number
     FROM driver_assignments da
     JOIN drivers d ON d.id = da.driver_id
     WHERE da.therapist_id = $1 AND da.assignment_date = $2
       AND d.is_active = true`,
    [therapistId, bookingDate]
  );
  if (existing.rows.length > 0) {
    console.log(`[DRIVER] Therapist ${therapistId} already has driver "${existing.rows[0].name}" on ${bookingDate}`);
    return existing.rows[0];
  }

  // 2. Find an active driver not yet assigned to anyone on this date
  const available = await pool.query(
    `SELECT * FROM drivers
     WHERE is_active = true
       AND id NOT IN (
         SELECT driver_id FROM driver_assignments WHERE assignment_date = $1
       )
     LIMIT 1`,
    [bookingDate]
  );

  let driver;
  if (available.rows.length > 0) {
    driver = available.rows[0];
  } else {
    // 3. All active drivers taken → prefer same-district driver, else least-loaded
    const fallback = await pool.query(
      `SELECT d.*, COUNT(da.id) AS assignments
       FROM drivers d
       LEFT JOIN driver_assignments da ON da.driver_id = d.id AND da.assignment_date = $1
       WHERE d.is_active = true
       GROUP BY d.id
       ORDER BY assignments ASC
       LIMIT 1`,
      [bookingDate]
    );
    if (!fallback.rows.length) {
      console.warn('[DRIVER] No drivers found in the system');
      return null;
    }
    driver = fallback.rows[0];
  }

  // Insert assignment
  await pool.query(
    `INSERT INTO driver_assignments (driver_id, therapist_id, assignment_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (therapist_id, assignment_date) DO UPDATE SET driver_id = $1`,
    [driver.id, therapistId, bookingDate]
  );

  console.log(`[DRIVER] Assigned driver "${driver.name}" to therapist ${therapistId} on ${bookingDate}${district ? ` (district: ${district})` : ''}`);
  return driver;
}

// ─── sendLocationPin ──────────────────────────────────────────────────────────
// Geocode an address (or use saved coords) and send a location pin.
// pinLabel appears as the title on the pin card.
async function sendLocationPin(chatId, booking, pinLabel) {
  // Use saved coordinates if available (home or center)
  if (booking.latitude && booking.longitude) {
    await sendLocation(chatId, parseFloat(booking.latitude), parseFloat(booking.longitude), pinLabel);
    return;
  }

  // No coords saved — fallback to geocode for center only
  if (booking.location_type === 'center') {
    const coords = await geocode('Healing Space Center, Khaleej District, Riyadh');
    if (coords) {
      await sendLocation(chatId, coords.lat, coords.lng, pinLabel);
    } else {
      console.warn(`[DRIVER] Could not geocode center address`);
    }
    return;
  }

  console.warn(`[DRIVER] No coordinates available for home booking — location pin skipped`);
}

// ─── sendDriverScheduleMessage ────────────────────────────────────────────────
/**
 * Send full day schedule to a driver.
 * One summary text (with all details) + one location pin per booking.
 * Used by the daily morning cron.
 */
async function sendDriverScheduleMessage(driverName, driverPhone, therapistName, therapistId, date) {
  const result = await pool.query(
    `SELECT b.start_time, b.end_time, b.location_type,
            cl.district, cl.city, cl.latitude, cl.longitude,
            s.name AS service_name,
            c.full_name AS customer_name, c.phone AS customer_phone
     FROM bookings b
     LEFT JOIN customer_locations cl ON cl.id = b.location_id
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN customer c ON c.id = b.customer_id
     WHERE b.therapist_id = $1
       AND b.booking_date = $2
       AND b.status NOT IN ('cancelled')
     ORDER BY b.start_time ASC`,
    [therapistId, date]
  );

  if (!result.rows.length) {
    console.log(`[DRIVER] No bookings for therapist ${therapistId} on ${date} — skipping`);
    return;
  }

  const waId = normalizeToWaId(driverPhone);
  if (!waId) {
    console.warn(`[DRIVER] Could not normalize phone "${driverPhone}" — skipping`);
    return;
  }
  const chatId = `${waId}@c.us`;

  // Build summary with full details per appointment
  const dateDisplay = formatDateDisplay(date);
  const lines = result.rows.map((b, i) => {
    const time    = formatTime12h(b.start_time);
    const endTime = b.end_time ? formatTime12h(String(b.end_time).substring(0, 5)) : null;
    const area = b.location_type === 'center'
      ? 'Healing Space Center, Khaleej'
      : [b.district, b.city].filter(Boolean).join(', ') || 'Home';
    return [
      `*${i + 1}. ${time}${endTime ? ` – ${endTime}` : ''}*`,
      `   Service  : ${b.service_name || 'N/A'}`,
      `   Customer : ${b.customer_name || 'N/A'}`,
      `   Phone    : ${b.customer_phone ? `+${b.customer_phone}` : 'N/A'}`,
      `   Area     : ${area}`,
    ].join('\n');
  });

  const msg = [
    `🚗 *Schedule for ${dateDisplay}*`,
    `Provider: ${therapistName}`,
    `Total: ${result.rows.length} appointment(s)`,
    `─────────────────`,
    ...lines.join('\n─────────────────\n').split('\n'),
    `─────────────────`,
  ].join('\n');

  try {
    await sendMessage(chatId, msg);
    console.log(`[DRIVER] Schedule sent to "${driverName}" for ${date}`);

    // One location pin per booking (label = appointment number + time + customer)
    for (const [i, b] of result.rows.entries()) {
      const time    = formatTime12h(b.start_time);
      const area = b.location_type === 'center'
        ? 'Healing Space Center, Khaleej District'
        : [b.district, b.city].filter(Boolean).join(', ') || 'Home';
      const pinLabel = `${i + 1}. ${time} | ${b.customer_name || 'Customer'} | ${area}`;
      await sendLocationPin(chatId, b, pinLabel);
      console.log(`[DRIVER] Pin sent for appointment ${i + 1} (${time})`);
    }
  } catch (err) {
    console.error(`[DRIVER] Failed to send schedule to "${driverName}":`, err.message);
  }
}

// ─── notifyDriverSameDayBooking ───────────────────────────────────────────────
/**
 * Called immediately after a same-day booking is confirmed.
 * Sends ONLY the new booking's details + location pin to the assigned driver.
 * (Full day schedule comes via morning cron — no need to resend everything.)
 */
async function notifyDriverSameDayBooking(therapistId, bookingDate, bookingId) {
  // Get active driver assigned to this therapist today
  const driverRes = await pool.query(
    `SELECT d.name AS driver_name, d.phone_number, t.full_name AS therapist_name
     FROM driver_assignments da
     JOIN drivers d    ON d.id = da.driver_id
     JOIN therapists t ON t.id = da.therapist_id
     WHERE da.therapist_id = $1 AND da.assignment_date = $2
       AND d.is_active = true`,
    [therapistId, bookingDate]
  );
  if (!driverRes.rows.length) return;

  // Get the specific booking details
  const bookingRes = await pool.query(
    `SELECT b.start_time, b.end_time, b.location_type,
            cl.district, cl.city, cl.latitude, cl.longitude,
            s.name AS service_name,
            c.full_name AS customer_name, c.phone AS customer_phone
     FROM bookings b
     LEFT JOIN customer_locations cl ON cl.id = b.location_id
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN customer c ON c.id = b.customer_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (!bookingRes.rows.length) return;

  const driver  = driverRes.rows[0];
  const b       = bookingRes.rows[0];
  const waId    = normalizeToWaId(driver.phone_number);
  if (!waId) return;

  const chatId  = `${waId}@c.us`;
  const time    = formatTime12h(b.start_time);
  const endTime = b.end_time ? formatTime12h(String(b.end_time).substring(0, 5)) : null;
  const area = b.location_type === 'center'
    ? 'Healing Space Center, Khaleej District'
    : [b.district, b.city].filter(Boolean).join(', ') || 'Home';
  const dateDisplay = formatDateDisplay(bookingDate);

  const msg = [
    `🔔 *New Booking Confirmed*`,
    `Provider : ${driver.therapist_name}`,
    `Date     : ${dateDisplay}`,
    `─────────────────`,
    `🕐 Time     : ${time}${endTime ? ` – ${endTime}` : ''}`,
    `💆 Service  : ${b.service_name || 'N/A'}`,
    `👤 Customer : ${b.customer_name || 'N/A'}`,
    `📞 Phone    : ${b.customer_phone ? `+${b.customer_phone}` : 'N/A'}`,
    `📌 Area     : ${area}`,
  ].join('\n');

  try {
    await sendMessage(chatId, msg);
    const pinLabel = `${time} | ${b.customer_name || 'Customer'} | ${area}`;
    await sendLocationPin(chatId, b, pinLabel);
    console.log(`[DRIVER] New booking notification sent to "${driver.driver_name}" for ${time}`);
  } catch (err) {
    console.error(`[DRIVER] Failed to notify driver for new booking:`, err.message);
  }
}

// ─── sendDriverSchedules ──────────────────────────────────────────────────────
/**
 * Send all drivers their full schedule for a given date.
 * Called by the daily morning cron.
 */
async function sendDriverSchedules(date) {
  const assignments = await pool.query(
    `SELECT da.therapist_id, d.name AS driver_name, d.phone_number,
            t.full_name AS therapist_name
     FROM driver_assignments da
     JOIN drivers d    ON d.id = da.driver_id
     JOIN therapists t ON t.id = da.therapist_id
     WHERE da.assignment_date = $1
       AND d.is_active = true`,
    [date]
  );

  if (!assignments.rows.length) {
    console.log(`[DRIVER] No driver assignments for ${date}`);
    return;
  }

  for (const row of assignments.rows) {
    await sendDriverScheduleMessage(
      row.driver_name, row.phone_number, row.therapist_name, row.therapist_id, date
    );
  }
}

// ─── startDriverScheduler ─────────────────────────────────────────────────────
/**
 * Daily cron — fires at 8 AM Riyadh (05:00 UTC).
 * Sends each driver their full schedule for TODAY.
 */
function startDriverScheduler() {
  // "0 5 * * *" = 05:00 UTC = 08:00 Riyadh (UTC+3)
  cron.schedule('0 5 * * *', async () => {
    const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    console.log(`[DRIVER] Morning cron fired — sending schedules for ${today}`);
    try {
      await sendDriverSchedules(today);
    } catch (err) {
      console.error('[DRIVER] Scheduler error:', err.message);
    }
  }, { timezone: 'UTC' });

  console.log('[DRIVER] Morning schedule cron started (fires at 8 AM Riyadh / 5 AM UTC)');
}

// ─── sendTherapistSchedules ───────────────────────────────────────────────────
/**
 * Send all therapists their full schedule for a given date.
 */
async function sendTherapistSchedules(date) {
  const result = await pool.query(
    `SELECT t.id AS therapist_id, t.full_name AS therapist_name, t.whatsapp_number
     FROM therapists t
     WHERE t.id IN (SELECT DISTINCT therapist_id FROM bookings WHERE booking_date = $1 AND status NOT IN ('cancelled'))
       AND t.is_active = true`,
    [date]
  );

  if (!result.rows.length) {
    console.log(`[NOTIFY] No therapists with bookings on ${date}`);
    return;
  }

  for (const therapist of result.rows) {
    const waId = normalizeToWaId(therapist.whatsapp_number);
    if (!waId) continue;
    const chatId = `${waId}@c.us`;

    const bookingsRes = await pool.query(
      `SELECT b.start_time, b.end_time, b.location_type, cl.district, cl.city,
              cl.latitude, cl.longitude, s.name AS service_name, s.price,
              c.full_name AS customer_name, c.phone AS customer_phone
       FROM bookings b
       LEFT JOIN customer_locations cl ON cl.id = b.location_id
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN customer c ON c.id = b.customer_id
       WHERE b.therapist_id = $1 AND b.booking_date = $2 AND b.status NOT IN ('cancelled')
       ORDER BY b.start_time ASC`,
      [therapist.therapist_id, date]
    );

    const lines = bookingsRes.rows.map((b, i) => {
      return t.therapistBookingItemLine({
        num: i + 1,
        time: formatTime12h(b.start_time),
        service: b.service_name,
        customer: b.customer_name,
        phone: normalizeToWaId(b.customer_phone),
        district: b.district || 'At Center',
        price: b.price
      });
    });

    const msg = t.therapistDailySummary({
      dateDisplay: formatDateDisplay(date),
      therapistName: therapist.therapist_name,
      bookingsCount: bookingsRes.rows.length,
      lines
    });

    try {
      await sendMessage(chatId, msg);
      // Send location pins for each
      for (const [i, b] of bookingsRes.rows.entries()) {
        const time    = formatTime12h(b.start_time);
        const area = b.location_type === 'center'
          ? 'Healing Space Center, Khaleej District'
          : [b.district, b.city].filter(Boolean).join(', ') || 'Home';
        const pinLabel = `${i + 1}. ${time} | ${b.customer_name || 'Customer'} | ${area}`;
        await sendLocationPin(chatId, b, pinLabel);
      }
      console.log(`[NOTIFY] Daily summary sent to therapist ${therapist.therapist_name}`);
    } catch (err) {
      console.error(`[NOTIFY] Failed to send summary to ${therapist.therapist_name}:`, err.message);
    }
  }
}

// ─── startTherapistScheduler ──────────────────────────────────────────────────
/**
 * Daily cron — fires at 23:59 Riyadh (20:59 UTC).
 * Sends each therapist their full schedule for TOMORROW.
 */
function startTherapistScheduler() {
  // "59 20 * * *" = 20:59 UTC = 23:59 Riyadh (UTC+3)
  cron.schedule('59 20 * * *', async () => {
    // Tomorrow's date in Riyadh
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    console.log(`[NOTIFY] Night cron fired — sending therapist schedules for ${tomorrowStr}`);
    try {
      await sendTherapistSchedules(tomorrowStr);
    } catch (err) {
      console.error('[NOTIFY] Therapist Scheduler error:', err.message);
    }
  }, { timezone: 'UTC' });

  console.log('[NOTIFY] Nightly therapist schedule cron started (fires at 23:59 Riyadh / 20:59 UTC)');
}

module.exports = { assignDriver, notifyDriverSameDayBooking, sendDriverSchedules, startDriverScheduler, startTherapistScheduler };
