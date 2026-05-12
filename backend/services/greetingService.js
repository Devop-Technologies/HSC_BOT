const { pool } = require('../db');

/**
 * Get the active greeting message.
 * @returns {Promise<{message_en: string, message_ar: string} | null>}
 */
async function getActiveGreeting() {
  const result = await pool.query(
    'SELECT message_en, message_ar FROM greetings WHERE is_active = true ORDER BY id DESC LIMIT 1'
  );
  return result.rows[0] || null;
}

/**
 * Get all past and present greeting messages for admin panel.
 */
async function getAllGreetings() {
  const result = await pool.query(
    'SELECT * FROM greetings ORDER BY id DESC'
  );
  return result.rows;
}

/**
 * Create a new greeting and make it active (disabling others).
 */
async function addGreeting(message_en, message_ar) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Disable all other greetings
    await client.query('UPDATE greetings SET is_active = false');
    // Insert new greeting
    const result = await client.query(
      'INSERT INTO greetings (message_en, message_ar, is_active) VALUES ($1, $2, true) RETURNING *',
      [message_en, message_ar]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update an existing greeting message.
 */
async function updateGreeting(id, message_en, message_ar, is_active) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (is_active) {
      await client.query('UPDATE greetings SET is_active = false');
    }
    const result = await client.query(
      'UPDATE greetings SET message_en = $1, message_ar = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [message_en, message_ar, is_active, id]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete a greeting.
 */
async function deleteGreeting(id) {
  const result = await pool.query('DELETE FROM greetings WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

module.exports = {
  getActiveGreeting,
  getAllGreetings,
  addGreeting,
  updateGreeting,
  deleteGreeting
};
