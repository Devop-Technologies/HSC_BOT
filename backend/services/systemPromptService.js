const { pool } = require('../db');
const { getSystemPrompt } = require('../data/planText');
const { getAllServices, getAllPackages, getBusinessHours } = require('./dataService');

let cachedSystemPrompt = null;
let lastFetch = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get the active system prompt from the database.
 * Falls back to the hardcoded one in data/planText.js if no prompt is set in DB.
 * Caches for CACHE_TTL_MS to avoid DB hits on every message.
 */
async function getActiveSystemPrompt() {
  const now = Date.now();
  if (cachedSystemPrompt && (now - lastFetch) < CACHE_TTL_MS) {
    return cachedSystemPrompt;
  }

  try {
    const result = await pool.query(
      'SELECT prompt_text FROM system_prompts ORDER BY updated_at DESC LIMIT 1'
    );
    if (result.rows.length > 0 && result.rows[0].prompt_text) {
      cachedSystemPrompt = result.rows[0].prompt_text;
      lastFetch = now;
      return cachedSystemPrompt;
    }
  } catch (err) {
    console.error('[SYSTEM_PROMPT] DB fetch failed:', err.message);
  }

  // Fallback to hardcoded base prompt
  const services = await getAllServices();
  const packages = await getAllPackages();
  const hours = await getBusinessHours();
  return getSystemPrompt(services, packages, hours);
}

/**
 * Clear the cache so the next call fetches fresh from DB.
 */
function clearSystemPromptCache() {
  cachedSystemPrompt = null;
  lastFetch = 0;
}

/**
 * Update the system prompt in the database.
 */
async function updateSystemPrompt(promptText) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete old prompts and insert new one
    await client.query('DELETE FROM system_prompts');
    const result = await client.query(
      'INSERT INTO system_prompts (prompt_text) VALUES ($1) RETURNING *',
      [promptText]
    );
    await client.query('COMMIT');
    clearSystemPromptCache();
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get the latest system prompt (for GET API).
 */
async function getLatestSystemPrompt() {
  const result = await pool.query(
    'SELECT * FROM system_prompts ORDER BY updated_at DESC LIMIT 1'
  );
  return result.rows[0] || null;
}

module.exports = {
  getActiveSystemPrompt,
  updateSystemPrompt,
  getLatestSystemPrompt,
  clearSystemPromptCache,
};
