const { pool } = require('../db');

async function getAllRecommendations() {
  const result = await pool.query(`
    SELECT hr.*, 
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'name_ar', s.name_ar, 'price', s.price, 'duration_minutes', s.duration_minutes))
         FROM services s WHERE s.id = ANY(hr.service_ids)),
        '[]'::jsonb
      ) as services
    FROM health_recommendations hr
    ORDER BY hr.sort_order ASC, hr.created_at ASC
  `);
  return result.rows;
}

async function getActiveRecommendations() {
  const result = await pool.query(`
    SELECT hr.*,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'name_ar', s.name_ar, 'price', s.price, 'duration_minutes', s.duration_minutes))
         FROM services s WHERE s.id = ANY(hr.service_ids)),
        '[]'::jsonb
      ) as services
    FROM health_recommendations hr
    WHERE hr.is_active = true
    ORDER BY hr.sort_order ASC, hr.created_at ASC
  `);
  return result.rows;
}

async function getRecommendationById(id) {
  const result = await pool.query(`
    SELECT hr.*,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'name_ar', s.name_ar, 'price', s.price, 'duration_minutes', s.duration_minutes))
         FROM services s WHERE s.id = ANY(hr.service_ids)),
        '[]'::jsonb
      ) as services
    FROM health_recommendations hr WHERE hr.id = $1
  `, [id]);
  return result.rows[0] || null;
}

async function createRecommendation(data) {
  const { keywords, keywords_ar, service_ids, why_en, why_ar, warning_en, warning_ar, sort_order } = data;
  const result = await pool.query(`
    INSERT INTO health_recommendations (keywords, keywords_ar, service_ids, why_en, why_ar, warning_en, warning_ar, sort_order)
    VALUES ($1::text[], $2::text[], $3::uuid[], $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    keywords || [],
    keywords_ar || [],
    service_ids || [],
    why_en,
    why_ar || null,
    warning_en || null,
    warning_ar || null,
    sort_order || 0,
  ]);
  return result.rows[0];
}

async function updateRecommendation(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  const fieldMap = {
    keywords: null,
    keywords_ar: null,
    service_ids: null,
    why_en: null,
    why_ar: null,
    warning_en: null,
    warning_ar: null,
    sort_order: null,
    is_active: null,
  };

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && key in fieldMap) {
      if (key === 'keywords' || key === 'keywords_ar') {
        fields.push(`${key} = $${idx++}::text[]`);
        values.push(val || []);
      } else if (key === 'service_ids') {
        fields.push(`${key} = $${idx++}::uuid[]`);
        values.push(val || []);
      } else {
        fields.push(`${key} = $${idx++}`);
        values.push(val === null ? null : val);
      }
    }
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query(`
    UPDATE health_recommendations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *
  `, values);
  return result.rows[0] || null;
}

async function deleteRecommendation(id) {
  const result = await pool.query('DELETE FROM health_recommendations WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

/**
 * Match a user message (EN or AR) to active health recommendations.
 */
async function matchRecommendation(text, lang = 'en') {
  const recs = await getActiveRecommendations();
  const lower = text.toLowerCase();

  for (const rec of recs) {
    const keywords = lang === 'ar' ? (rec.keywords_ar || []) : (rec.keywords || []);
    const match = keywords.some(kw => lower.includes(kw));
    if (match) return rec;
  }
  return null;
}

module.exports = {
  getAllRecommendations,
  getActiveRecommendations,
  getRecommendationById,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  matchRecommendation,
};
