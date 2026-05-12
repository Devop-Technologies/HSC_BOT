const { pool } = require('../db');
const templates = require('./messageTemplates');
const AR = templates.AR;

/**
 * Service for reading bot static messages from the bot_messages DB table.
 * Falls back to the hardcoded messageTemplates.js when not found in DB.
 */

let messagesCache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

async function refreshCache() {
  try {
    const result = await pool.query('SELECT key, message_en, message_ar FROM bot_messages');
    messagesCache = {};
    for (const row of result.rows) {
      messagesCache[row.key] = { en: row.message_en, ar: row.message_ar };
    }
    cacheTimestamp = Date.now();
  } catch (err) {
    console.error('[BOT_MESSAGES] Cache refresh failed:', err.message);
  }
}

async function ensureCache() {
  if (Object.keys(messagesCache).length === 0 || (Date.now() - cacheTimestamp) > CACHE_TTL) {
    await refreshCache();
  }
}

/**
 * Get a message template from DB or fallback.
 * Supports {name} style placeholders.
 */
async function getMessage(key, lang = 'en', placeholders = {}) {
  await ensureCache();
  
  const cached = messagesCache[key];
  let text = null;
  
  if (cached) {
    text = lang === 'ar' && cached.ar ? cached.ar : cached.en;
  }
  
  if (!text) {
    // Fallback to hardcoded templates
    try {
      const t = templates.forLang(lang);
      if (typeof t[key] === 'function') {
        text = t[key]();
      } else if (key === 'welcome_new') {
        text = t.welcomeNew();
      } else if (key === 'welcome_back') {
        text = t.welcomeBack(placeholders.name || '');
      } else if (key === 'main_menu') {
        text = t.mainMenu();
      } else if (key === 'did_not_understand') {
        text = t.didNotUnderstand();
      } else if (key === 'booking_confirmed') {
        text = t.bookingConfirmed(placeholders.name || 'dear customer');
      } else if (key === 'booking_cancelled') {
        text = t.bookingCancelled();
      } else if (key === 'no_availability') {
        text = t.noAvailability();
      }
    } catch (e) {
      console.error('[BOT_MESSAGES] Fallback failed for key:', key, e.message);
      return null;
    }
  }
  
  if (!text) return null;
  
  // Replace placeholders
  for (const [k, v] of Object.entries(placeholders)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  
  return text;
}

/**
 * Get all messages for the admin API.
 */
async function getAllMessages() {
  await ensureCache();
  const result = await pool.query('SELECT * FROM bot_messages ORDER BY key');
  return result.rows;
}

/**
 * Update or insert a message.
 */
async function upsertMessage(key, message_en, message_ar) {
  const result = await pool.query(
    `INSERT INTO bot_messages (key, message_en, message_ar, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key)
     DO UPDATE SET message_en = $2, message_ar = $3, updated_at = NOW()
     RETURNING *`,
    [key, message_en, message_ar || '']
  );
  // Invalidate cache
  cacheTimestamp = 0;
  messagesCache = {};
  return result.rows[0];
}

/**
 * Delete a message by key.
 */
async function deleteMessage(key) {
  const result = await pool.query('DELETE FROM bot_messages WHERE key = $1 RETURNING *', [key]);
  cacheTimestamp = 0;
  messagesCache = {};
  return result.rows[0];
}

module.exports = {
  getMessage,
  getAllMessages,
  upsertMessage,
  deleteMessage,
  refreshCache,
};
