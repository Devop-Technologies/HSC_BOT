const { pool } = require('../db');

async function getAllServices() {
  const result = await pool.query(
    'SELECT * FROM services WHERE is_active = true ORDER BY name'
  );
  return result.rows;
}

// 1-based index
async function getServiceByIndex(index) {
  const result = await pool.query(
    'SELECT * FROM services WHERE is_active = true ORDER BY name LIMIT 1 OFFSET $1',
    [index - 1]
  );
  return result.rows[0] || null;
}

async function getServiceById(id) {
  const result = await pool.query('SELECT * FROM services WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getAllPackages() {
  const result = await pool.query(
    `SELECT * FROM packages WHERE is_active = true ORDER BY CASE WHEN name ILIKE 'Pure Bliss%' THEN 1 WHEN name ILIKE 'Wellness%' THEN 2 WHEN name ILIKE 'Loyalty%' THEN 3 ELSE 4 END, total_sessions, name`
  );
  return result.rows;
}

async function getBusinessHours() {
  const result = await pool.query(
    'SELECT * FROM business_hours ORDER BY service_type, is_ramadan'
  );
  return result.rows;
}

async function getTherapistById(id) {
  const result = await pool.query('SELECT * FROM therapists WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function isProviderPhone(phone) {
  const result = await pool.query(
    `SELECT id FROM therapists WHERE whatsapp_number = $1 AND is_active = true LIMIT 1`,
    [phone]
  );
  return result.rows.length > 0;
}

async function getTherapistByPhone(phone) {
  const result = await pool.query(
    `SELECT id, full_name FROM therapists WHERE whatsapp_number = $1 AND is_active = true LIMIT 1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function getActiveHumanAgents() {
  const result = await pool.query(
    `SELECT id, name, phone_number FROM human_agents WHERE is_active = true ORDER BY created_at ASC`
  );
  return result.rows;
}

module.exports = {
  getAllServices,
  getServiceByIndex,
  getServiceById,
  getAllPackages,
  getBusinessHours,
  getTherapistById,
  isProviderPhone,
  getTherapistByPhone,
  getActiveHumanAgents,
};
