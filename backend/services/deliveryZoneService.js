const { pool } = require('../db');

function normalizeBand(row) {
  if (!row) return null;
  return {
    ...row,
    // The admin screen historically called these "zones" and used district.
    // Runtime delivery pricing now uses tariff bands, so expose aliases for UI compatibility.
    district: row.label,
    min_km: row.min_km === null ? null : Number(row.min_km),
    max_km: row.max_km === null ? null : Number(row.max_km),
    base_fee: row.base_fee === null ? 0 : Number(row.base_fee),
    fee_per_km: row.fee_per_km === null ? 0 : Number(row.fee_per_km),
  };
}

function labelFrom(data = {}) {
  return String(data.label ?? data.district ?? '').trim();
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function moneyNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getAllZones() {
  const result = await pool.query(`
    SELECT *
    FROM delivery_tariff_bands
    ORDER BY sort_order ASC, min_km ASC, max_km ASC NULLS LAST, label ASC
  `);
  return result.rows.map(normalizeBand);
}

async function getZoneById(id) {
  const result = await pool.query('SELECT * FROM delivery_tariff_bands WHERE id = $1', [id]);
  return normalizeBand(result.rows[0]);
}

async function getZoneByDistrict(district) {
  const result = await pool.query(
    'SELECT * FROM delivery_tariff_bands WHERE label ILIKE $1 AND is_active = true LIMIT 1',
    [district]
  );
  return normalizeBand(result.rows[0]);
}

async function calculateDeliveryFee(district) {
  const zone = await getZoneByDistrict(district);
  if (!zone) return null;
  return Number(zone.base_fee);
}

async function createZone(data) {
  const label = labelFrom(data);
  if (!label) throw new Error('label is required');
  const minKm = nullableNumber(data.min_km) ?? 0;
  const maxKm = nullableNumber(data.max_km);
  const baseFee = moneyNumber(data.base_fee, 0);
  const feePerKm = moneyNumber(data.fee_per_km, 0);
  const rawSort = data.sort_order === undefined || data.sort_order === null || data.sort_order === ''
    ? Math.round(minKm * 100)
    : Number(data.sort_order);
  const sortOrder = Number.isFinite(rawSort) ? rawSort : 0;

  const result = await pool.query(`
    INSERT INTO delivery_tariff_bands (label, min_km, max_km, base_fee, fee_per_km, sort_order, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))
    RETURNING *
  `, [label, minKm, maxKm, baseFee, feePerKm, sortOrder, data.is_active]);
  return normalizeBand(result.rows[0]);
}

async function updateZone(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  const label = labelFrom(data);
  if (label) {
    fields.push(`label = $${idx++}`);
    values.push(label);
  }
  if (data.min_km !== undefined) {
    fields.push(`min_km = $${idx++}`);
    values.push(nullableNumber(data.min_km) ?? 0);
  }
  if (data.max_km !== undefined) {
    fields.push(`max_km = $${idx++}`);
    values.push(nullableNumber(data.max_km));
  }
  if (data.base_fee !== undefined) {
    fields.push(`base_fee = $${idx++}`);
    values.push(moneyNumber(data.base_fee, 0));
  }
  if (data.fee_per_km !== undefined) {
    fields.push(`fee_per_km = $${idx++}`);
    values.push(moneyNumber(data.fee_per_km, 0));
  }
  if (data.sort_order !== undefined) {
    fields.push(`sort_order = $${idx++}`);
    values.push(Number(data.sort_order) || 0);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(Boolean(data.is_active));
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query(`
    UPDATE delivery_tariff_bands SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *
  `, values);
  return normalizeBand(result.rows[0]);
}

async function deleteZone(id) {
  const result = await pool.query('DELETE FROM delivery_tariff_bands WHERE id = $1 RETURNING *', [id]);
  return normalizeBand(result.rows[0]);
}

module.exports = {
  getAllZones,
  getZoneById,
  getZoneByDistrict,
  calculateDeliveryFee,
  createZone,
  updateZone,
  deleteZone,
};
