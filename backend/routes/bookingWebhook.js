const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { updateCalendarEvent, deleteCalendarEvent } = require('../services/googleCalendarService');
const { sendMessage } = require('../services/wahaService');
const { updateSession } = require('../services/sessionService');
const t = require('../services/messageTemplates');

/**
 * POST /booking-webhook
 *
 * Supabase Database Webhook — fires on bookings INSERT / UPDATE / DELETE.
 * Automatically syncs the Google Calendar event based on what changed.
 *
 * Setup in Supabase:
 *   Dashboard → Database → Webhooks → New webhook
 *   Table: bookings | Events: UPDATE, DELETE
 *   URL: http://your-server/booking-webhook
 *   Header: x-webhook-secret = BOOKING_WEBHOOK_SECRET (env var)
 */
router.post('/', async (req, res) => {
  // Optional secret check (set BOOKING_WEBHOOK_SECRET in .env + Supabase webhook header)
  const secret = process.env.BOOKING_WEBHOOK_SECRET;
  if (secret && req.headers['x-webhook-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.status(200).json({ status: 'received' }); // respond fast

  const { type, record, old_record } = req.body;
  const booking = record || old_record;

  if (!booking) return;

  console.log(`[BOOKING-WH] type=${type} bookingId=${booking.id} status=${booking.status}`);

  try {
    // ── COMPLETED → send rating request to customer ───────────────────────────
    if (
      type === 'UPDATE' &&
      record?.status === 'completed' &&
      old_record?.status !== 'completed'
    ) {
      const [customerRes, sessionRes, serviceRes] = await Promise.all([
        pool.query('SELECT id, full_name, phone FROM customer WHERE id = $1', [booking.customer_id]),
        pool.query('SELECT current_step FROM bot_sessions WHERE customer_id = $1', [booking.customer_id]),
        booking.service_id
          ? pool.query('SELECT name FROM services WHERE id = $1', [booking.service_id])
          : Promise.resolve({ rows: [{}] }),
      ]);
      const customer    = customerRes.rows[0];
      const currentStep = sessionRes.rows[0]?.current_step;
      const serviceName = serviceRes.rows[0]?.name || null;
      // Skip if botHandler already set the rating step (provider "done" path)
      if (customer?.phone && currentStep !== 'booking_rating') {
        const chatId = `${customer.phone}@c.us`;
        await sendMessage(chatId, t.askRating(customer.full_name, {
          serviceName,
          date: booking.booking_date,
          time: booking.start_time,
        }));
        await updateSession(customer.id, 'booking_rating', {
          rating_booking_id:   booking.id,
          rating_therapist_id: booking.therapist_id || null,
        });
        console.log(`[BOOKING-WH] Rating request sent to ${customer.full_name} for booking ${booking.id}`);
      } else {
        console.log(`[BOOKING-WH] Rating already triggered for booking ${booking.id} — skipping`);
      }
    }

    // ── Calendar sync — only runs if calendar_event_id exists ─────────────────
    const eventId = booking.calendar_event_id;
    if (!eventId) return;

    // ── DELETE or CANCELLED → remove calendar event ───────────────────────────
    if (
      type === 'DELETE' ||
      (type === 'UPDATE' && booking.status === 'cancelled')
    ) {
      await deleteCalendarEvent(eventId);
      console.log(`[BOOKING-WH] Calendar event deleted for booking ${booking.id}`);
      return;
    }

    // ── UPDATE → sync calendar event with latest booking data ─────────────────
    if (type === 'UPDATE') {
      const [customerRes, therapistRes, serviceRes, locationRes] = await Promise.all([
        pool.query('SELECT full_name, phone FROM customer WHERE id = $1', [booking.customer_id]),
        booking.therapist_id
          ? pool.query('SELECT full_name FROM therapists WHERE id = $1', [booking.therapist_id])
          : Promise.resolve({ rows: [{}] }),
        booking.service_id
          ? pool.query('SELECT name, duration_minutes FROM services WHERE id = $1', [booking.service_id])
          : Promise.resolve({ rows: [{}] }),
        booking.location_id
          ? pool.query('SELECT latitude, longitude FROM customer_locations WHERE id = $1', [booking.location_id])
          : Promise.resolve({ rows: [{}] }),
      ]);

      const customerName  = customerRes.rows[0]?.full_name  || 'Client';
      const customerPhone = customerRes.rows[0]?.phone       || 'N/A';
      const therapistName = therapistRes.rows[0]?.full_name  || 'TBD';
      const latitude      = locationRes.rows[0]?.latitude    || null;
      const longitude     = locationRes.rows[0]?.longitude   || null;

      await updateCalendarEvent(eventId, {
        serviceId:    booking.service_id,
        date:         booking.booking_date,
        time:         booking.start_time,
        locationType: booking.location_type,
        customerName,
        customerPhone,
        therapistName,
        latitude,
        longitude,
      });

      console.log(`[BOOKING-WH] Calendar event updated for booking ${booking.id}`);
    }

  } catch (err) {
    console.error(`[BOOKING-WH] Error:`, err.message);
  }
});

module.exports = router;
