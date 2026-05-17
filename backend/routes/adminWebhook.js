const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { sendMessage }  = require('../services/wahaService');
const { updateSession } = require('../services/sessionService');
const t = require('../services/messageTemplates');

/**
 * POST /admin-webhook/booking-status
 *
 * Called by the admin panel when a booking status is changed.
 * If status becomes 'completed', sends a rating request to the customer via WhatsApp.
 *
 * Body: { bookingId: "uuid", status: "completed" }
 * Header: x-admin-secret (must match ADMIN_WEBHOOK_SECRET in .env)
 */
router.post('/booking-status', async (req, res) => {
  // Secret check
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (secret && req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { bookingId, status } = req.body;

  if (!bookingId || !status) {
    return res.status(400).json({ error: 'bookingId and status are required' });
  }

  res.status(200).json({ received: true }); // respond fast

  if (status !== 'completed') return; // only care about completed

  try {
    // Fetch booking + customer info in one query
    const result = await pool.query(
      `SELECT b.id, b.therapist_id, b.rating, b.booking_date, b.start_time,
              c.id AS customer_id, c.full_name, c.phone,
              s.name AS service_name
       FROM bookings b
       JOIN customer c ON c.id = b.customer_id
       LEFT JOIN services s ON s.id = b.service_id
       WHERE b.id = $1`,
      [bookingId]
    );

    const booking = result.rows[0];
    if (!booking) {
      console.warn(`[ADMIN-WH] Booking ${bookingId} not found`);
      return;
    }

    // Skip if rating already collected
    if (booking.rating !== null) {
      console.log(`[ADMIN-WH] Booking ${bookingId} already has rating — skipping`);
      return;
    }

    // Check if customer session already in rating step (bot already triggered it)
    const sessionRes = await pool.query(
      'SELECT current_step FROM bot_sessions WHERE customer_id = $1',
      [booking.customer_id]
    );
    if (sessionRes.rows[0]?.current_step === 'booking_rating') {
      console.log(`[ADMIN-WH] Rating already triggered for booking ${bookingId} — skipping`);
      return;
    }

    // Send rating request to customer
    const chatId = `${booking.phone}@c.us`;
    await sendMessage(chatId, t.askRating(booking.full_name, {
      serviceName: booking.service_name || null,
      date: booking.booking_date || null,
      time: booking.start_time || null,
    }));
    await updateSession(booking.customer_id, 'booking_rating', {
      rating_booking_id:   booking.id,
      rating_therapist_id: booking.therapist_id || null,
    });

    console.log(`[ADMIN-WH] Rating request sent to ${booking.full_name} for booking ${bookingId}`);
  } catch (err) {
    console.error('[ADMIN-WH] Error:', err.message);
  }
});

module.exports = router;
