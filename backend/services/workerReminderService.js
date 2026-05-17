const cron = require('node-cron');
const { pool } = require('../db');
const wahaService = require('./wahaService');
const { normalizeToWaId } = require('../utils/helpers');
const t = require('./messageTemplates');
const mediaArtifactService = require('./mediaArtifactService');

const WINDOW_START_MINUTES = 19;
const WINDOW_END_MINUTES = 21;

let reminderRunInProgress = false;

function formatTime12h(timeStr) {
  if (!timeStr) return 'N/A';
  const [h, m] = String(timeStr).substring(0, 5).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return 'Today';
  const value = dateStr instanceof Date ? dateStr.toISOString().slice(0, 10) : String(dateStr).slice(0, 10);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(`${value}T12:00:00Z`);
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} (${days[d.getUTCDay()]})`;
}

function toChatId(phone) {
  const waId = normalizeToWaId(phone);
  return waId ? `${waId}@c.us` : null;
}

async function ensureWorkerReminderColumns() {
  await pool.query(`
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS provider_reminder_20m_sent_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS driver_reminder_20m_sent_at TIMESTAMP
  `);
}

async function getDueWorkerReminderBookings() {
  const result = await pool.query(
    `SELECT
        b.id,
        b.customer_id,
        b.location_id,
        b.booking_date,
        b.start_time,
        b.location_type,
        b.provider_reminder_20m_sent_at,
        b.driver_reminder_20m_sent_at,
        s.name AS service_name,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        cl.district,
        cl.city,
        th.full_name AS provider_name,
        th.whatsapp_number AS provider_whatsapp,
        d.name AS driver_name,
        d.phone_number AS driver_phone
     FROM bookings b
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN customer c ON c.id = b.customer_id
     LEFT JOIN customer_locations cl ON cl.id = b.location_id
     LEFT JOIN therapists th ON th.id = b.therapist_id
     LEFT JOIN driver_assignments da
       ON da.therapist_id = b.therapist_id
      AND da.assignment_date = b.booking_date
     LEFT JOIN drivers d ON d.id = da.driver_id AND d.is_active = true
     WHERE b.status NOT IN ('cancelled', 'completed')
       AND b.therapist_id IS NOT NULL
       AND (b.provider_reminder_20m_sent_at IS NULL OR b.driver_reminder_20m_sent_at IS NULL)
       AND (b.booking_date::timestamp + b.start_time)
             BETWEEN ((NOW() AT TIME ZONE 'Asia/Riyadh') + ($1::int * INTERVAL '1 minute'))
                 AND ((NOW() AT TIME ZONE 'Asia/Riyadh') + ($2::int * INTERVAL '1 minute'))
     ORDER BY b.booking_date ASC, b.start_time ASC
     LIMIT 25`,
    [WINDOW_START_MINUTES, WINDOW_END_MINUTES]
  );
  return result.rows;
}

async function markProviderReminderSent(bookingId) {
  await pool.query(
    `UPDATE bookings
     SET provider_reminder_20m_sent_at = NOW()
     WHERE id = $1 AND provider_reminder_20m_sent_at IS NULL`,
    [bookingId]
  );
}

async function markDriverReminderSent(bookingId) {
  await pool.query(
    `UPDATE bookings
     SET driver_reminder_20m_sent_at = NOW()
     WHERE id = $1 AND driver_reminder_20m_sent_at IS NULL`,
    [bookingId]
  );
}


async function forwardDoorImageForReminder(booking, chatId, recipientType) {
  const artifact = await mediaArtifactService.getDoorImageArtifactForBooking({
    bookingId: booking.id,
    customerId: booking.customer_id,
    locationId: booking.location_id,
  });

  if (!artifact?.message_id) return false;

  try {
    await wahaService.forwardMessage(chatId, artifact.message_id);
    console.log(`[WORKER_REMINDER] Door image forwarded to ${recipientType} for booking ${booking.id} (artifact ${artifact.id || 'unknown'})`);
    return true;
  } catch (err) {
    console.error(`[WORKER_REMINDER] Door image forward failed to ${recipientType} for booking ${booking.id}:`, err.message);
    return false;
  }
}

async function sendProviderReminder(booking) {
  if (booking.provider_reminder_20m_sent_at) return false;
  const chatId = toChatId(booking.provider_whatsapp);
  if (!chatId) {
    console.warn(`[WORKER_REMINDER] Booking ${booking.id}: provider WhatsApp missing/invalid`);
    return false;
  }

  const msg = t.providerBookingReminder({
    serviceName: booking.service_name,
    customerName: booking.customer_name,
    customerPhone: normalizeToWaId(booking.customer_phone),
    date: formatDateDisplay(booking.booking_date),
    time: formatTime12h(booking.start_time),
    locationType: booking.location_type,
    district: booking.district,
    city: booking.city,
    driverName: booking.driver_name,
  });

  await wahaService.sendMessage(chatId, msg);
  await forwardDoorImageForReminder(booking, chatId, 'provider');
  await markProviderReminderSent(booking.id);
  console.log(`[WORKER_REMINDER] Provider reminder sent for booking ${booking.id}`);
  return true;
}

async function sendDriverReminder(booking) {
  if (booking.driver_reminder_20m_sent_at) return false;
  const chatId = toChatId(booking.driver_phone);
  if (!chatId) {
    console.warn(`[WORKER_REMINDER] Booking ${booking.id}: driver WhatsApp missing/invalid/not assigned`);
    return false;
  }

  const msg = t.driverBookingReminder({
    providerName: booking.provider_name,
    serviceName: booking.service_name,
    customerName: booking.customer_name,
    customerPhone: normalizeToWaId(booking.customer_phone),
    date: formatDateDisplay(booking.booking_date),
    time: formatTime12h(booking.start_time),
    locationType: booking.location_type,
    district: booking.district,
    city: booking.city,
  });

  await wahaService.sendMessage(chatId, msg);
  await forwardDoorImageForReminder(booking, chatId, 'driver');
  await markDriverReminderSent(booking.id);
  console.log(`[WORKER_REMINDER] Driver reminder sent for booking ${booking.id}`);
  return true;
}

async function runWorkerReminderSweep() {
  if (reminderRunInProgress) {
    console.log('[WORKER_REMINDER] Previous sweep still running — skipped');
    return { skipped: true, due: 0, providerSent: 0, driverSent: 0, errors: 0 };
  }

  reminderRunInProgress = true;
  const stats = { skipped: false, due: 0, providerSent: 0, driverSent: 0, errors: 0 };

  try {
    const bookings = await getDueWorkerReminderBookings();
    stats.due = bookings.length;

    for (const booking of bookings) {
      try {
        if (await sendProviderReminder(booking)) stats.providerSent += 1;
      } catch (err) {
        stats.errors += 1;
        console.error(`[WORKER_REMINDER] Provider reminder failed for booking ${booking.id}:`, err.message);
      }

      try {
        if (await sendDriverReminder(booking)) stats.driverSent += 1;
      } catch (err) {
        stats.errors += 1;
        console.error(`[WORKER_REMINDER] Driver reminder failed for booking ${booking.id}:`, err.message);
      }
    }

    if (bookings.length) {
      console.log(`[WORKER_REMINDER] Sweep complete: due=${stats.due}, providerSent=${stats.providerSent}, driverSent=${stats.driverSent}, errors=${stats.errors}`);
    }
    return stats;
  } finally {
    reminderRunInProgress = false;
  }
}

async function startWorkerReminderScheduler() {
  await ensureWorkerReminderColumns();

  cron.schedule('* * * * *', async () => {
    try {
      await runWorkerReminderSweep();
    } catch (err) {
      console.error('[WORKER_REMINDER] Scheduler error:', err.message);
    }
  }, { timezone: 'UTC' });

  console.log('[WORKER_REMINDER] T-minus-20 provider/driver reminder cron started (every minute)');
}

module.exports = {
  ensureWorkerReminderColumns,
  getDueWorkerReminderBookings,
  sendProviderReminder,
  sendDriverReminder,
  forwardDoorImageForReminder,
  runWorkerReminderSweep,
  startWorkerReminderScheduler,
};
