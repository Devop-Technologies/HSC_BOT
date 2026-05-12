const { pool } = require('../db');

async function getOrCreateSession(customerId) {
  const existing = await pool.query(
    'SELECT * FROM bot_sessions WHERE customer_id = $1',
    [customerId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const result = await pool.query(
    `INSERT INTO bot_sessions (id, customer_id, current_step, session_data, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'welcome', '{}', NOW(), NOW()) RETURNING *`,
    [customerId]
  );
  return result.rows[0];
}

// Merge new data into session_data and update step
async function updateSession(customerId, step, data = null) {
  if (data) {
    await pool.query(
      `UPDATE bot_sessions
       SET current_step = $1,
           session_data = COALESCE(session_data, '{}'::jsonb) || $2::jsonb,
           updated_at   = NOW()
       WHERE customer_id = $3`,
      [step, JSON.stringify(data), customerId]
    );
  } else {
    await pool.query(
      `UPDATE bot_sessions
       SET current_step = $1, updated_at = NOW()
       WHERE customer_id = $2`,
      [step, customerId]
    );
  }
}

// Go back to main_menu and clear temp booking data
async function resetSession(customerId) {
  await pool.query(
    `UPDATE bot_sessions
     SET current_step = 'main_menu',
         session_data = jsonb_build_object('lang', COALESCE(session_data->>'lang', 'en')),
         updated_at   = NOW()
     WHERE customer_id = $1`,
    [customerId]
  );
}

module.exports = { getOrCreateSession, updateSession, resetSession };
