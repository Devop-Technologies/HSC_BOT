const { pool } = require('../db');

async function getAllFaqs() {
  const result = await pool.query('SELECT * FROM faq_items ORDER BY sort_order ASC, created_at ASC');
  return result.rows;
}

async function getActiveFaqs() {
  const result = await pool.query('SELECT * FROM faq_items WHERE is_active = true ORDER BY sort_order ASC, created_at ASC');
  return result.rows;
}

async function getFaqById(id) {
  const result = await pool.query('SELECT * FROM faq_items WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createFaq(data) {
  const { question_en, question_ar, answer_en, answer_ar, sort_order } = data;
  const result = await pool.query(`
    INSERT INTO faq_items (question_en, question_ar, answer_en, answer_ar, sort_order)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [question_en, question_ar || null, answer_en, answer_ar || null, sort_order || 0]);
  return result.rows[0];
}

async function updateFaq(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && ['question_en', 'question_ar', 'answer_en', 'answer_ar', 'sort_order', 'is_active'].includes(key)) {
      fields.push(`${key} = $${idx++}`);
      values.push(val === null ? null : val);
    }
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query(`
    UPDATE faq_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *
  `, values);
  return result.rows[0] || null;
}

async function deleteFaq(id) {
  const result = await pool.query('DELETE FROM faq_items WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

/**
 * Build FAQ text for the bot, from DB items.
 */
async function buildFaqMessage(lang = 'en') {
  const items = await getActiveFaqs();
  if (!items.length) return null;

  const header = lang === 'ar'
    ? '*الأسئلة الشائعة*\n─────────────────\n\n'
    : '*Frequently Asked Questions*\n─────────────────\n\n';

  const body = items
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, i) => {
      const q = lang === 'ar' && item.question_ar ? item.question_ar : item.question_en;
      const a = lang === 'ar' && item.answer_ar ? item.answer_ar : item.answer_en;
      return `*${i + 1}. ${q}*\n${a}`;
    })
    .join('\n\n');

  return header + body + `\n\n─────────────────\n` +
    (lang === 'ar' ? 'اكتبي *0* للقائمة الرئيسية.' : 'Type *0* for main menu.');
}

module.exports = {
  getAllFaqs,
  getActiveFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  buildFaqMessage,
};
