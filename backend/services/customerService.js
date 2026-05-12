const { pool } = require('../db');

// Returns { customer, isNew }
async function getOrCreateCustomer(phone) {
  const existing = await pool.query(
    'SELECT * FROM customer WHERE phone = $1',
    [phone]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE customer SET last_active_at = NOW() WHERE id = $1',
      [existing.rows[0].id]
    );
    return { customer: existing.rows[0], isNew: false };
  }

  const result = await pool.query(
    `INSERT INTO customer (id, phone, created_at, last_active_at)
     VALUES (gen_random_uuid(), $1, NOW(), NOW()) RETURNING *`,
    [phone]
  );
  return { customer: result.rows[0], isNew: true };
}

async function updateCustomerName(customerId, name) {
  const result = await pool.query(
    'UPDATE customer SET full_name = $1 WHERE id = $2 RETURNING *',
    [name, customerId]
  );
  return result.rows[0];
}

async function updateCustomerEmail(customerId, email) {
  const result = await pool.query(
    'UPDATE customer SET email = $1 WHERE id = $2 RETURNING *',
    [email, customerId]
  );
  return result.rows[0];
}

module.exports = { getOrCreateCustomer, updateCustomerName, updateCustomerEmail };
