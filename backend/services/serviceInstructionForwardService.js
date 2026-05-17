const fs = require('fs');
const path = require('path');
const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'data', 'serviceInstructionForwards.json');

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-');
}

function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  try {
    if (!fs.existsSync(configPath)) return { enabled: true, entries: [] };
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return {
      enabled: parsed.enabled !== false,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch (err) {
    console.warn('[SERVICE_INSTRUCTIONS] invalid config:', err.message);
    return { enabled: false, entries: [] };
  }
}

function serviceKeys(service = {}) {
  const keys = new Set();
  for (const value of [
    service.id,
    service.service_id,
    service.selected_service_id,
    service.service_price_option_id,
    service.selected_service_price_option_id,
    service.option_id,
    service.price_option_id,
    service.name,
    service.name_ar,
    service.selected_service_name,
    service.selected_service_name_ar,
    service.slug,
  ]) {
    if (value !== null && value !== undefined && String(value).trim()) {
      keys.add(String(value));
      keys.add(normalizeKey(value));
    }
  }
  return keys;
}

function entryMatches(entry = {}, { service = {}, trigger = 'service_detail', lang = null } = {}) {
  // Placeholder entries are scaffolding for admins; never send them to customers.
  if (entry.enabled === false || entry.placeholder === true) return false;
  const triggers = Array.isArray(entry.triggers)
    ? entry.triggers
    : (entry.trigger ? [entry.trigger] : ['service_detail']);
  if (!triggers.includes(trigger) && !triggers.includes('*')) return false;
  if (entry.lang && lang && entry.lang !== lang && entry.lang !== '*') return false;

  const keys = serviceKeys(service);
  const configuredKeys = [
    entry.service_id,
    entry.catalog_node_id,
    entry.service_price_option_id,
    entry.service_key,
    entry.slug,
    entry.service_name,
    entry.service_name_ar,
  ].filter((value) => value !== null && value !== undefined && String(value).trim());

  return configuredKeys.some((value) => keys.has(String(value)) || keys.has(normalizeKey(value)));
}

function textForLang(entry = {}, lang = 'en') {
  const text = entry.text || {};
  if (typeof text === 'string') return text.trim();
  if (lang === 'ar' && text.ar) return String(text.ar).trim();
  if (text.en) return String(text.en).trim();
  return '';
}

function resolveInstructionEntries({ service, trigger = 'service_detail', lang = 'en', config = loadConfig() } = {}) {
  if (!config.enabled) return [];
  return config.entries.filter((entry) => entryMatches(entry, { service, trigger, lang }));
}

async function forwardServiceInstructions({ chatId, service, trigger = 'service_detail', lang = 'en', config, waha = null } = {}) {
  if (!chatId || !service) return { attempted: 0, forwarded: 0, textSent: 0, errors: [] };
  const entries = resolveInstructionEntries({ service, trigger, lang, config: config || loadConfig() });
  const sender = waha || require('./wahaService');
  const stats = { attempted: 0, forwarded: 0, textSent: 0, errors: [] };

  for (const entry of entries) {
    const text = textForLang(entry, lang);
    if (text) {
      stats.attempted += 1;
      try {
        await sender.sendMessage(chatId, text);
        stats.textSent += 1;
      } catch (err) {
        stats.errors.push({ type: 'text', key: entry.service_key || entry.service_id || entry.slug || null, error: err.message });
        console.warn('[SERVICE_INSTRUCTIONS] text send failed:', err.message);
      }
    }

    const messageIds = Array.isArray(entry.messageIds) ? entry.messageIds.filter(Boolean) : [];
    for (const messageId of messageIds) {
      stats.attempted += 1;
      try {
        await sender.forwardMessage(chatId, messageId);
        stats.forwarded += 1;
      } catch (err) {
        stats.errors.push({ type: 'forward', messageId, error: err.message });
        console.warn('[SERVICE_INSTRUCTIONS] forward failed:', err.message);
      }
    }
  }

  if (stats.attempted > 0) {
    console.log(`[SERVICE_INSTRUCTIONS] trigger=${trigger} service=${service.id || service.name || 'unknown'} attempted=${stats.attempted} text=${stats.textSent} forwarded=${stats.forwarded} errors=${stats.errors.length}`);
  }
  return stats;
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  loadConfig,
  resolveInstructionEntries,
  forwardServiceInstructions,
  normalizeKey,
};
