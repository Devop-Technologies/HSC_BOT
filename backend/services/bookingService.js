const { pool } = require('../db');
const { completePackageRedemption, reservePackageForBooking } = require('./packageWalletService');
const { qualifyReferralForBooking } = require('./referralService');

// Convert a JS Date to "YYYY-MM-DD" using LOCAL date components
// (avoids UTC offset shifting the date by 1 day in non-UTC timezones)
function toLocalISODate(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Try to parse user-entered date string to YYYY-MM-DD
function tryParseDate(str) {
  if (!str) return null;
  const year  = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Normalize Arabic months to English so JS Date can parse them
  let normalized = str.toLowerCase()
    .replace(/يناير/g, 'January')
    .replace(/فبراير/g, 'February')
    .replace(/مارس/g, 'March')
    .replace(/[أا]بريل/g, 'April')
    .replace(/مايو/g, 'May')
    .replace(/يونيو/g, 'June')
    .replace(/يوليو/g, 'July')
    .replace(/[أا]غسطس/g, 'August')
    .replace(/سبتمبر/g, 'September')
    .replace(/[أا]كتوبر/g, 'October')
    .replace(/نوفمبر/g, 'November')
    .replace(/ديسمبر/g, 'December');

  // Try "25 Feb" or "Feb 25" + current year
  let parsed = new Date(`${normalized} ${year}`);
  if (!isNaN(parsed.getTime()) && parsed >= today) {
    return toLocalISODate(parsed);
  }
  // If the month already passed, try next year (e.g. user says "Jan 5" in March)
  parsed = new Date(`${normalized} ${year + 1}`);
  if (!isNaN(parsed.getTime())) {
    return toLocalISODate(parsed);
  }
  // Try direct ISO format (YYYY-MM-DD) — must be today or future
  parsed = new Date(normalized);
  if (!isNaN(parsed.getTime()) && parsed >= today) {
    return toLocalISODate(parsed);
  }
  return null;
}

// Try to parse user-entered time string to HH:MM:SS
function tryParseTime(str) {
  if (!str) return null;
  const parsed = new Date(`2000-01-01 ${str}`);
  if (!isNaN(parsed)) {
    const h = String(parsed.getHours()).padStart(2, '0');
    const m = String(parsed.getMinutes()).padStart(2, '0');
    return `${h}:${m}:00`;
  }
  return null;
}


function toMoney(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n * 100) / 100;
}

function sanitizeGiftDetails(value) {
  if (!value || typeof value !== 'object') return null;
  const clean = {};
  const pickText = (key, max = 240) => {
    const raw = value[key];
    if (raw === undefined || raw === null) return;
    const text = String(raw).trim();
    if (text) clean[key] = text.slice(0, max);
  };
  pickText('recipient_name', 120);
  pickText('recipient_phone', 40);
  pickText('instructions', 500);
  pickText('voucher_code', 80);
  if (!Object.keys(clean).length) return null;
  return { is_gift: true, ...clean };
}

function buildPricingSnapshot(data = {}) {
  const serviceUnitPrice = toMoney(data.serviceUnitPrice ?? data.service_unit_price ?? data.selected_service_price ?? data.price, 0);
  const serviceTotal = toMoney(data.serviceTotal ?? data.service_total, serviceUnitPrice);
  const deliveryFee = toMoney(data.deliveryFee ?? data.delivery_fee, 0);
  const deliveryKm = toMoney(data.deliveryKm ?? data.delivery_km, null);
  const discountPercent = toMoney(data.discountPercent ?? data.discount_percent, 0);
  const discountAmount = toMoney(data.discountAmount ?? data.discount_amount, Math.round((serviceTotal * discountPercent / 100) * 100) / 100);
  const finalTotal = toMoney(data.finalTotal ?? data.final_total, Math.max(0, Math.round((serviceTotal + deliveryFee - discountAmount) * 100) / 100));
  const deliveryTariffBasis = data.deliveryTariffBasis || data.delivery_tariff_basis || {
    zone: data.deliveryZone ?? data.delivery_zone ?? null,
    method: data.deliveryQuoteMethod ?? data.delivery_quote_method ?? null,
  };

  const snapshot = {
    service_id: data.serviceId ?? data.service_id ?? null,
    service_name: data.serviceName ?? data.service_name ?? null,
    service_price_option_id: data.servicePriceOptionId ?? data.service_price_option_id ?? null,
    service_option_label: data.serviceOptionLabel ?? data.service_option_label ?? null,
    service_unit_price: serviceUnitPrice,
    service_total: serviceTotal,
    delivery_fee: deliveryFee,
    delivery_km: deliveryKm,
    delivery_quote_method: data.deliveryQuoteMethod ?? data.delivery_quote_method ?? null,
    delivery_tariff_basis: deliveryTariffBasis,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    final_total: finalTotal,
    package_customer_id: data.packageCustomerId ?? data.package_customer_id ?? null,
    package_redemption_status: data.packageRedemptionStatus ?? data.package_redemption_status ?? null,
    package_pricing_source: data.packagePricingSource ?? data.package_pricing_source ?? 'standard',
    quoted_at: new Date().toISOString(),
  };

  return {
    servicePriceOptionId: snapshot.service_price_option_id,
    serviceOptionLabel: snapshot.service_option_label,
    serviceUnitPrice,
    serviceTotal,
    deliveryFee,
    deliveryKm,
    deliveryQuoteMethod: snapshot.delivery_quote_method,
    deliveryTariffBasis,
    discountPercent,
    discountAmount,
    finalTotal,
    packageCustomerId: snapshot.package_customer_id,
    packageRedemptionStatus: snapshot.package_redemption_status,
    packagePricingSource: snapshot.package_pricing_source,
    pricingSnapshot: snapshot,
  };
}

// Save or update customer's home location (sets as default)
// locationData: { address, latitude?, longitude?, maps_url? }
async function saveLocation(customerId, locationData) {
  // Support both old string format and new object format
  const data = typeof locationData === 'string'
    ? { address: locationData }
    : locationData;

  // Remove previous default
  await pool.query(
    'UPDATE customer_locations SET is_default = false WHERE customer_id = $1',
    [customerId]
  );

  const result = await pool.query(
    `INSERT INTO customer_locations
       (id, customer_id, address, district, city, latitude, longitude, maps_url, is_default, created_at)
     VALUES
       (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW())
     RETURNING *`,
    [
      customerId,
      data.address   || '',
      data.district  || null,
      data.city      || null,
      data.latitude  || null,
      data.longitude || null,
      data.maps_url  || null,
    ]
  );
  return result.rows[0];
}

async function getDefaultLocation(customerId) {
  const result = await pool.query(
    'SELECT * FROM customer_locations WHERE customer_id = $1 AND is_default = true',
    [customerId]
  );
  return result.rows[0] || null;
}

// Returns the customer's existing active booking on a given date, or null if none.
// rawDate is the same user-entered string that will be parsed before comparison.
async function getExistingBookingOnDate(customerId, rawDate) {
  const bookingDate = tryParseDate(rawDate);
  if (!bookingDate) return null;

  const result = await pool.query(
    `SELECT b.*, s.name AS service_name
     FROM bookings b
     LEFT JOIN services s ON s.id = b.service_id
     WHERE b.customer_id = $1
       AND b.booking_date = $2
       AND b.status != 'cancelled'
     ORDER BY b.created_at DESC
     LIMIT 1`,
    [customerId, bookingDate]
  );
  return result.rows[0] || null;
}

// Returns full booking history for a customer (all statuses, max 10)
async function getCustomerBookings(customerId) {
  const result = await pool.query(
    `SELECT b.booking_date, b.start_time, b.location_type, b.status, b.rating,
            s.name AS service_name,
            t.full_name AS therapist_name,
            cl.address
     FROM bookings b
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN therapists t ON t.id = b.therapist_id
     LEFT JOIN customer_locations cl ON cl.id = b.location_id
     WHERE b.customer_id = $1
     ORDER BY b.booking_date DESC, b.start_time DESC
     LIMIT 10`,
    [customerId]
  );
  return result.rows;
}

async function createBooking(data) {
  const {
    customerId, serviceId, locationType,
    rawDate, rawTime, locationId, therapistId,
  } = data;

  const bookingDate = tryParseDate(rawDate);
  const startTime   = tryParseTime(rawTime);

  // Calculate end_time = start_time + service duration
  let endTime = null;
  if (startTime && serviceId) {
    const svcResult = await pool.query(
      'SELECT duration_minutes FROM services WHERE id = $1',
      [serviceId]
    );
    const duration = Number(svcResult.rows[0]?.duration_minutes) || 0;
    if (duration > 0) {
      const [h, m] = startTime.split(':').map(Number);
      const endMins = h * 60 + m + duration;
      const endH = Math.floor(endMins / 60) % 24;
      const endM = endMins % 60;
      endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    }
  }

  const pricing = buildPricingSnapshot({ ...data, serviceId });
  const giftDetails = sanitizeGiftDetails(data.giftDetails || data.gift_details);

  const columns = [
    'id', 'customer_id', 'service_id', 'location_type', 'booking_date', 'start_time', 'end_time', 'location_id', 'therapist_id', 'status', 'payment_status', 'created_at',
    'service_price_option_id', 'service_option_label', 'service_unit_price', 'service_total', 'delivery_fee', 'delivery_km', 'delivery_quote_method', 'delivery_tariff_basis',
    'discount_percent', 'discount_amount', 'final_total', 'pricing_snapshot', 'package_customer_id', 'package_redemption_status', 'package_pricing_source',
  ];
  const valuesSql = [
    'gen_random_uuid()', '$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', "'pending'", "'unpaid'", 'NOW()',
    '$9', '$10', '$11', '$12', '$13', '$14', '$15', '$16::jsonb', '$17', '$18', '$19', '$20::jsonb', '$21', '$22', '$23',
  ];
  const params = [
    customerId,
    serviceId    || null,
    locationType,
    bookingDate  || null,
    startTime    || null,
    endTime      || null,
    locationId   || null,
    therapistId  || null,
    pricing.servicePriceOptionId,
    pricing.serviceOptionLabel,
    pricing.serviceUnitPrice,
    pricing.serviceTotal,
    pricing.deliveryFee,
    pricing.deliveryKm,
    pricing.deliveryQuoteMethod,
    JSON.stringify(pricing.deliveryTariffBasis || {}),
    pricing.discountPercent,
    pricing.discountAmount,
    pricing.finalTotal,
    JSON.stringify(pricing.pricingSnapshot || {}),
    pricing.packageCustomerId,
    pricing.packageRedemptionStatus,
    pricing.packagePricingSource,
  ];
  if (giftDetails) {
    columns.push('gift_details');
    params.push(JSON.stringify(giftDetails));
    valuesSql.push(`$${params.length}::jsonb`);
  }

  const result = await pool.query(
    `INSERT INTO bookings (${columns.join(', ')})
     VALUES (${valuesSql.join(', ')})
     RETURNING *`,
    params
  );
  return result.rows[0];
}

// Save Google Calendar event ID to booking after event is created
async function saveCalendarEventId(bookingId, eventId) {
  await pool.query(
    'UPDATE bookings SET calendar_event_id = $1 WHERE id = $2',
    [eventId, bookingId]
  );
}

// ─── confirmBookingAtomic ─────────────────────────────────────────────────────
// Creates a booking AND district lock inside a single DB transaction.
// Prevents the race condition where two customers both pass revalidateTherapist
// and then both write a booking to the same slot.
// Throws with err.code === 'SLOT_CONFLICT' or 'DISTRICT_CONFLICT' on failure.
async function confirmBookingAtomic({ customerId, serviceId, locationType, rawDate, rawTime, locationId, therapistId, district, pricingSnapshot = {}, giftDetails = null }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bookingDate = tryParseDate(rawDate);
    const startTime   = tryParseTime(rawTime);
    if (!bookingDate || !startTime) throw new Error('Invalid date or time');

    // Calculate end_time
    let endTime = null;
    if (serviceId) {
      const svcRes = await client.query('SELECT duration_minutes FROM services WHERE id = $1', [serviceId]);
      const duration = Number(svcRes.rows[0]?.duration_minutes) || 0;
      if (duration > 0) {
        const [h, m] = startTime.split(':').map(Number);
        const endMins = h * 60 + m + duration;
        endTime = `${String(Math.floor(endMins / 60) % 24).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
      }
    }

    if (therapistId) {
      // Guard 1: therapist must not be locked to a DIFFERENT district today
      if (district) {
        const lockConflict = await client.query(
          `SELECT district FROM provider_district_locks
           WHERE therapist_id = $1 AND lock_date = $2 AND district != $3
           FOR UPDATE`,
          [therapistId, bookingDate, district]
        );
        if (lockConflict.rows.length > 0) {
          throw Object.assign(new Error('district_conflict'), { code: 'DISTRICT_CONFLICT' });
        }
      }

      // Guard 2: no overlapping booking for this therapist at this time.
      // Travel buffer (15 min) included on both sides — same rule as slot generation.
      // New slot [startTime, endTime+15] must not overlap any existing [start, end+15].
      if (endTime) {
        const slotConflict = await client.query(
          `SELECT id FROM bookings
           WHERE therapist_id = $1 AND booking_date = $2 AND status != 'cancelled'
             AND start_time < $3::time + INTERVAL '15 minutes'
             AND end_time   + INTERVAL '15 minutes' > $4::time
           FOR UPDATE`,
          [therapistId, bookingDate, endTime, startTime]
        );
        if (slotConflict.rows.length > 0) {
          throw Object.assign(new Error('slot_conflict'), { code: 'SLOT_CONFLICT' });
        }
      }
    }

    // Insert booking with immutable pricing snapshot from the confirmed session state.
    const pricing = buildPricingSnapshot({ ...pricingSnapshot, serviceId });
    const cleanGiftDetails = sanitizeGiftDetails(giftDetails);
    const columns = [
      'id', 'customer_id', 'service_id', 'location_type', 'booking_date', 'start_time', 'end_time', 'location_id', 'therapist_id', 'status', 'payment_status', 'created_at',
      'service_price_option_id', 'service_option_label', 'service_unit_price', 'service_total', 'delivery_fee', 'delivery_km', 'delivery_quote_method', 'delivery_tariff_basis',
      'discount_percent', 'discount_amount', 'final_total', 'pricing_snapshot', 'package_customer_id', 'package_redemption_status', 'package_pricing_source',
    ];
    const valuesSql = [
      'gen_random_uuid()', '$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', "'pending'", "'unpaid'", 'NOW()',
      '$9', '$10', '$11', '$12', '$13', '$14', '$15', '$16::jsonb', '$17', '$18', '$19', '$20::jsonb', '$21', '$22', '$23',
    ];
    const params = [
      customerId, serviceId || null, locationType, bookingDate, startTime, endTime || null, locationId || null, therapistId || null,
      pricing.servicePriceOptionId,
      pricing.serviceOptionLabel,
      pricing.serviceUnitPrice,
      pricing.serviceTotal,
      pricing.deliveryFee,
      pricing.deliveryKm,
      pricing.deliveryQuoteMethod,
      JSON.stringify(pricing.deliveryTariffBasis || {}),
      pricing.discountPercent,
      pricing.discountAmount,
      pricing.finalTotal,
      JSON.stringify(pricing.pricingSnapshot || {}),
      pricing.packageCustomerId,
      pricing.packageRedemptionStatus,
      pricing.packagePricingSource,
    ];
    if (cleanGiftDetails) {
      columns.push('gift_details');
      params.push(JSON.stringify(cleanGiftDetails));
      valuesSql.push(`$${params.length}::jsonb`);
    }

    const result = await client.query(
      `INSERT INTO bookings (${columns.join(', ')})
       VALUES (${valuesSql.join(', ')})
       RETURNING *`,
      params
    );

    if (pricing.packageCustomerId) {
      await reservePackageForBooking({
        customerPackageId: pricing.packageCustomerId,
        bookingId: result.rows[0].id,
        serviceId,
        servicePriceOptionId: pricing.servicePriceOptionId || null,
        pricingSnapshot: pricing.pricingSnapshot || {},
        notes: 'Reserved at booking confirmation',
      }, client);
    }

    // Lock district atomically with the booking
    if (therapistId && district && bookingDate) {
      await client.query(
        `INSERT INTO provider_district_locks (therapist_id, lock_date, district)
         VALUES ($1, $2, $3)
         ON CONFLICT (therapist_id, lock_date) DO NOTHING`,
        [therapistId, bookingDate, district]
      );
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Cancel a booking and return its calendar_event_id (for calendar deletion)
async function cancelBooking(bookingId) {
  const result = await pool.query(
    "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING calendar_event_id",
    [bookingId]
  );
  return result.rows[0]?.calendar_event_id || null;
}

async function findAndCompleteActiveBooking(therapistId) {
  const now = new Date();
  const today = toLocalISODate(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find the most recently started booking today that isn't finished/cancelled
    const result = await client.query(
      `SELECT b.id, b.customer_id, b.therapist_id, b.booking_date, b.start_time, b.end_time,
              b.package_customer_id, b.package_redemption_status,
              s.name as service_name, c.full_name as customer_name, c.phone as customer_phone
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN customer c ON c.id = b.customer_id
       WHERE b.therapist_id = $1
         AND b.booking_date = $2
         AND b.status NOT IN ('completed', 'cancelled')
         AND b.start_time <= $3
       ORDER BY b.start_time DESC
       LIMIT 1
       FOR UPDATE OF b`,
      [therapistId, today, currentTime]
    );

    if (result.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const booking = result.rows[0];
    if (booking.package_customer_id && booking.package_redemption_status !== 'completed') {
      await completePackageRedemption({ bookingId: booking.id }, client);
    }

    await client.query(
      "UPDATE bookings SET status = 'completed' WHERE id = $1",
      [booking.id]
    );

    await qualifyReferralForBooking({ referredCustomerId: booking.customer_id, bookingId: booking.id }, client);

    await client.query('COMMIT');
    return booking;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Save customer rating for a booking and update therapist running totals
async function saveBookingRating(bookingId, rating, therapistId) {
  await pool.query(
    'UPDATE bookings SET rating = $1 WHERE id = $2',
    [rating, bookingId]
  );
  if (therapistId) {
    await pool.query(
      `UPDATE therapists
       SET total_bookings = total_bookings + 1,
           total_rating   = total_rating   + $1
       WHERE id = $2`,
      [rating, therapistId]
    );
  }
}

// Save customer feedback text for a booking
async function saveBookingFeedback(bookingId, feedback) {
  await pool.query(
    'UPDATE bookings SET feedback = $1 WHERE id = $2',
    [feedback, bookingId]
  );
}

// Returns pending/confirmed bookings eligible for reschedule/cancel/update (max 5)
async function getReschedulableBookings(customerId) {
  const result = await pool.query(
    `SELECT b.id, b.booking_date, b.start_time, b.location_type, b.status,
            b.service_id, b.therapist_id, b.location_id, b.calendar_event_id,
            s.name AS service_name, s.duration_minutes, s.price,
            t.full_name AS therapist_name,
            cl.address, cl.district
     FROM bookings b
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN therapists t ON t.id = b.therapist_id
     LEFT JOIN customer_locations cl ON cl.id = b.location_id
     WHERE b.customer_id = $1
       AND b.status IN ('pending', 'confirmed')
     ORDER BY b.booking_date ASC, b.start_time ASC
     LIMIT 5`,
    [customerId]
  );
  return result.rows;
}

// Fetch a single booking by ID with full details
async function getBookingById(bookingId) {
  const result = await pool.query(
    `SELECT b.id, b.service_id, b.location_type, b.location_id, b.booking_date,
            b.start_time, b.therapist_id, b.calendar_event_id, b.status,
            b.service_price_option_id, b.service_option_label, b.service_unit_price, b.service_total,
            b.delivery_fee, b.delivery_km, b.delivery_quote_method, b.delivery_tariff_basis,
            b.discount_percent, b.discount_amount, b.final_total,
            b.package_customer_id, b.package_redemption_status, b.package_pricing_source,
            s.name AS service_name, s.duration_minutes, s.price,
            t.full_name AS therapist_name,
            cl.address, cl.district
     FROM bookings b
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN therapists t ON t.id = b.therapist_id
     LEFT JOIN customer_locations cl ON cl.id = b.location_id
     WHERE b.id = $1`,
    [bookingId]
  );
  return result.rows[0] || null;
}

// Update an existing booking's date and time (recalculates end_time from service duration)
async function updateBookingDateTime(bookingId, { date, time, therapistId }) {
  const bookingDate = tryParseDate(date) || date;
  const startTime   = tryParseTime(time) || time;

  // Recalculate end_time from the booking's own service duration
  let endTime = null;
  const svcRes = await pool.query(
    `SELECT s.duration_minutes FROM bookings b
     JOIN services s ON s.id = b.service_id WHERE b.id = $1`,
    [bookingId]
  );
  const duration = Number(svcRes.rows[0]?.duration_minutes) || 0;
  if (duration > 0 && startTime) {
    const [h, m] = startTime.split(':').map(Number);
    const endMins = h * 60 + m + duration;
    const endH = Math.floor(endMins / 60) % 24;
    const endM = endMins % 60;
    endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }

  await pool.query(
    `UPDATE bookings SET booking_date = $1, start_time = $2, end_time = $3, therapist_id = $4
     WHERE id = $5`,
    [bookingDate, startTime, endTime, therapistId || null, bookingId]
  );
}

// Update an existing booking's location and, when provided, its immutable pricing quote snapshot.
async function updateBookingLocation(bookingId, { locationId, locationType, pricingSnapshot = null }) {
  if (!pricingSnapshot) {
    await pool.query(
      `UPDATE bookings SET location_id = $1, location_type = $2 WHERE id = $3`,
      [locationId, locationType, bookingId]
    );
    return;
  }

  const pricing = buildPricingSnapshot(pricingSnapshot);
  await pool.query(
    `UPDATE bookings
     SET location_id = $1,
         location_type = $2,
         service_price_option_id = $3,
         service_option_label = $4,
         service_unit_price = $5,
         service_total = $6,
         delivery_fee = $7,
         delivery_km = $8,
         delivery_quote_method = $9,
         delivery_tariff_basis = $10,
         discount_percent = $11,
         discount_amount = $12,
         final_total = $13,
         pricing_snapshot = $14,
         package_customer_id = COALESCE($15, package_customer_id),
         package_redemption_status = COALESCE($16, package_redemption_status),
         package_pricing_source = COALESCE($17, package_pricing_source)
     WHERE id = $18`,
    [
      locationId,
      locationType,
      pricing.servicePriceOptionId,
      pricing.serviceOptionLabel,
      pricing.serviceUnitPrice,
      pricing.serviceTotal,
      pricing.deliveryFee,
      pricing.deliveryKm,
      pricing.deliveryQuoteMethod,
      pricing.deliveryTariffBasis,
      pricing.discountPercent,
      pricing.discountAmount,
      pricing.finalTotal,
      pricing.pricingSnapshot,
      pricing.packageCustomerId,
      pricing.packageRedemptionStatus,
      pricing.packagePricingSource,
      bookingId,
    ]
  );
}

module.exports = {
  saveLocation,
  getDefaultLocation,
  createBooking,
  confirmBookingAtomic,
  saveCalendarEventId,
  cancelBooking,
  getExistingBookingOnDate,
  getCustomerBookings,
  tryParseDate,
  tryParseTime,
  findAndCompleteActiveBooking,
  saveBookingRating,
  saveBookingFeedback,
  getReschedulableBookings,
  getBookingById,
  updateBookingDateTime,
  updateBookingLocation,
};

