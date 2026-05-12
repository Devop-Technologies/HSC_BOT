const { pool } = require('../db');

async function logMessage(phone, message, direction, customerId = null) {
  try {
    await pool.query(
      `INSERT INTO whatsapp_logs (id, phone, message, direction, customer_id, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [phone, message, direction, customerId]
    );
  } catch (err) {
    // Non-critical — don't crash the bot if logging fails
    console.error('Log error:', err.message);
  }
}

// Fetch last N messages for a customer (oldest first).
// Skips long outgoing template messages (menus/summaries) — they add noise to AI context.
async function getRecentMessages(customerId, limit = 10) {
  try {
    const result = await pool.query(
      `SELECT direction, message
       FROM whatsapp_logs
       WHERE customer_id = $1
         AND (direction = 'incoming' OR (direction = 'outgoing' AND LENGTH(message) < 120))
       ORDER BY created_at DESC
       LIMIT $2`,
      [customerId, limit]
    );
    return result.rows.reverse(); // oldest → newest
  } catch (err) {
    console.error('getRecentMessages error:', err.message);
    return [];
  }
}

module.exports = { logMessage, getRecentMessages };
