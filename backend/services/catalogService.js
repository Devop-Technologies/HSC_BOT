
const { pool } = require('../db');

function normalizeNode(row) {
  return {
    ...row,
    children: [],
    price_options: row.price_options || [],
  };
}

function buildTree(rows) {
  const map = new Map();
  const roots = [];

  for (const row of rows) {
    map.set(row.id, normalizeNode(row));
  }

  for (const row of rows) {
    const node = map.get(row.id);
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      const sa = a.sort_order ?? 999999;
      const sb = b.sort_order ?? 999999;
      if (sa != sb) return sa - sb;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    for (const node of nodes) {
      if (node.children?.length) sortNodes(node.children);
    }
  };

  sortNodes(roots);
  return roots;
}

async function getPriceOptionsMap(client) {
  try {
    const result = await client.query(
      `SELECT * FROM service_price_options ORDER BY sort_order ASC, id ASC`
    );
    const map = new Map();
    for (const row of result.rows) {
      if (!map.has(row.service_id)) map.set(row.service_id, []);
      map.get(row.service_id).push(row);
    }
    return map;
  } catch (err) {
    if (/relation .*service_price_options.* does not exist/i.test(err.message)) {
      return new Map();
    }
    throw err;
  }
}

async function getAllCatalogFlat({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE is_active = true' : '';
  const result = await pool.query(
    `SELECT * FROM services ${where}
     ORDER BY sort_order ASC NULLS LAST, created_at ASC, name ASC`
  );

  const priceOptionsMap = await getPriceOptionsMap(pool);
  return result.rows.map((row) => ({
    ...row,
    price_options: priceOptionsMap.get(row.id) || [],
  }));
}

async function getCatalogTree(options = {}) {
  const rows = await getAllCatalogFlat(options);
  return buildTree(rows);
}

async function getCatalogNode(id) {
  const result = await pool.query('SELECT * FROM services WHERE id = $1 LIMIT 1', [id]);
  if (!result.rows[0]) return null;
  const priceOptionsMap = await getPriceOptionsMap(pool);
  return {
    ...result.rows[0],
    price_options: priceOptionsMap.get(id) || [],
    children: [],
  };
}

async function createCatalogNode(payload) {
  const {
    name,
    name_ar = null,
    description = null,
    icon = null,
    parent_id = null,
    sort_order = 0,
    price = null,
    duration_minutes = null,
    oil_based = false,
    available_for_home = false,
    available_in_center = false,
    service_category = 'service',
    delivery_fee = null,
    is_active = true,
    price_options = [],
  } = payload;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO services (
        name, name_ar, description, icon, parent_id, sort_order,
        price, duration_minutes, oil_based, available_for_home, available_in_center,
        service_category, delivery_fee, is_active
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,$14
      ) RETURNING *`,
      [
        name, name_ar, description, icon, parent_id, sort_order,
        price, duration_minutes, oil_based, available_for_home, available_in_center,
        service_category, delivery_fee, is_active,
      ]
    );
    const created = inserted.rows[0];

    if (Array.isArray(price_options) && price_options.length > 0) {
      for (let i = 0; i < price_options.length; i++) {
        const po = price_options[i];
        if (po.price == null && po.duration_minutes == null && po.delivery_fee == null && !po.label) continue;
        await client.query(
          `INSERT INTO service_price_options
           (service_id, duration_minutes, price, delivery_fee, label, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [created.id, po.duration_minutes ?? null, po.price ?? null, po.delivery_fee ?? null, po.label ?? null, po.sort_order ?? i]
        );
      }
    }

    await client.query('COMMIT');
    return await getCatalogNode(created.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateCatalogNode(id, updates) {
  const fields = [
    'name', 'name_ar', 'description', 'icon', 'parent_id', 'sort_order',
    'price', 'duration_minutes', 'delivery_fee', 'oil_based',
    'available_for_home', 'available_in_center', 'is_active', 'service_category',
  ];
  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      setClauses.push(`${field} = $${idx++}`);
      values.push(updates[field]);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (setClauses.length > 0) {
      values.push(id);
      const result = await client.query(
        `UPDATE services SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'price_options')) {
      try {
        await client.query('DELETE FROM service_price_options WHERE service_id = $1', [id]);
        const options = Array.isArray(updates.price_options) ? updates.price_options : [];
        for (let i = 0; i < options.length; i++) {
          const po = options[i];
          if (po.price == null && po.duration_minutes == null && po.delivery_fee == null && !po.label) continue;
          await client.query(
            `INSERT INTO service_price_options
             (service_id, duration_minutes, price, delivery_fee, label, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, po.duration_minutes ?? null, po.price ?? null, po.delivery_fee ?? null, po.label ?? null, po.sort_order ?? i]
          );
        }
      } catch (err) {
        if (!/relation .*service_price_options.* does not exist/i.test(err.message)) throw err;
      }
    }

    await client.query('COMMIT');
    return await getCatalogNode(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteCatalogNode(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM service_price_options WHERE service_id = $1', [id]);
    } catch (err) {
      if (!/relation .*service_price_options.* does not exist/i.test(err.message)) throw err;
    }
    await client.query('UPDATE services SET parent_id = NULL WHERE parent_id = $1', [id]);
    const result = await client.query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  buildTree,
  getAllCatalogFlat,
  getCatalogTree,
  getCatalogNode,
  createCatalogNode,
  updateCatalogNode,
  deleteCatalogNode,
};
