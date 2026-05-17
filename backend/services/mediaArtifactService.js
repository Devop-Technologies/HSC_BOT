const { pool } = require('../db');

async function saveIncomingMediaArtifact({
  customerId,
  bookingId = null,
  locationId = null,
  messageId,
  chatId = null,
  mediaType = 'image',
  purpose = 'door_image',
  caption = null,
  metadata = {},
}) {
  if (!customerId) throw new Error('customerId is required');
  if (!messageId) throw new Error('messageId is required');

  const result = await pool.query(
    `INSERT INTO customer_media_artifacts
       (id, customer_id, booking_id, location_id, message_id, chat_id, media_type, purpose, caption, metadata, created_at)
     VALUES
       (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
     ON CONFLICT (message_id) DO UPDATE
       SET customer_id = EXCLUDED.customer_id,
           booking_id  = COALESCE(EXCLUDED.booking_id, customer_media_artifacts.booking_id),
           location_id = COALESCE(EXCLUDED.location_id, customer_media_artifacts.location_id),
           chat_id     = COALESCE(EXCLUDED.chat_id, customer_media_artifacts.chat_id),
           media_type  = EXCLUDED.media_type,
           purpose     = EXCLUDED.purpose,
           caption     = COALESCE(EXCLUDED.caption, customer_media_artifacts.caption),
           metadata    = customer_media_artifacts.metadata || EXCLUDED.metadata,
           updated_at  = NOW()
     RETURNING *`,
    [
      customerId,
      bookingId,
      locationId,
      messageId,
      chatId,
      mediaType,
      purpose,
      caption,
      JSON.stringify(metadata || {}),
    ]
  );

  return result.rows[0];
}

async function getLatestMediaArtifactForCustomer(customerId, purpose = 'door_image') {
  const result = await pool.query(
    `SELECT *
       FROM customer_media_artifacts
      WHERE customer_id = $1
        AND purpose = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [customerId, purpose]
  );
  return result.rows[0] || null;
}


async function getDoorImageArtifactForBooking({ bookingId, customerId, locationId = null }) {
  if (!bookingId && !customerId) return null;

  const result = await pool.query(
    `SELECT *
       FROM customer_media_artifacts
      WHERE purpose = 'door_image'
        AND media_type = 'image'
        AND (
             ($1::uuid IS NOT NULL AND booking_id = $1::uuid)
          OR ($2::uuid IS NOT NULL AND customer_id = $2::uuid AND (
                $3::uuid IS NULL
             OR location_id = $3::uuid
             OR location_id IS NULL
          ))
        )
      ORDER BY
        CASE
          WHEN $1::uuid IS NOT NULL AND booking_id = $1::uuid THEN 0
          WHEN $3::uuid IS NOT NULL AND location_id = $3::uuid THEN 1
          ELSE 2
        END,
        created_at DESC
      LIMIT 1`,
    [bookingId || null, customerId || null, locationId || null]
  );

  return result.rows[0] || null;
}

module.exports = {
  saveIncomingMediaArtifact,
  getLatestMediaArtifactForCustomer,
  getDoorImageArtifactForBooking,
};
