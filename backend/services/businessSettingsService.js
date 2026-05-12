const { pool } = require('../db');

/**
 * Get all business settings as a flat key-value map.
 */
async function getAllSettings() {
  const result = await pool.query('SELECT * FROM business_settings ORDER BY key');
  return result.rows;
}

/**
 * Get a single setting value by key.
 */
async function getSetting(key) {
  const result = await pool.query('SELECT * FROM business_settings WHERE key = $1', [key]);
  return result.rows[0] || null;
}

/**
 * Get a setting's value (string) by key, with optional default.
 */
async function getSettingValue(key, defaultValue = null) {
  const result = await pool.query('SELECT value FROM business_settings WHERE key = $1', [key]);
  return result.rows[0]?.value || defaultValue;
}

/**
 * Upsert a setting.
 */
async function upsertSetting(key, value, value_ar, description) {
  const result = await pool.query(`
    INSERT INTO business_settings (key, value, value_ar, description, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = $2, value_ar = COALESCE($3, business_settings.value_ar), description = COALESCE($4, business_settings.description), updated_at = NOW()
    RETURNING *
  `, [key, value, value_ar || null, description || null]);
  return result.rows[0];
}

/**
 * Delete a setting.
 */
async function deleteSetting(key) {
  const result = await pool.query('DELETE FROM business_settings WHERE key = $1 RETURNING *', [key]);
  return result.rows[0];
}

module.exports = {
  getAllSettings,
  getSetting,
  getSettingValue,
  upsertSetting,
  deleteSetting,
};
