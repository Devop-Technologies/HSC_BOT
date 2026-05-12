const { WAHA_API_URL, WAHA_API_KEY, SESSION } = require('../config');

async function wahaApi(endpoint, method = 'POST', body = {}) {
  const res = await fetch(`${WAHA_API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': WAHA_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// Resolve WhatsApp LID (@lid) to real phone number via WAHA contacts API.
// WhatsApp is rolling out LID (Linked Device ID) — some senders appear as
// "105046394060819@lid" instead of "966XXXXXXXXX@c.us". This resolves that.
// Returns the phone number string, or null if it can't be resolved.
async function resolveContactPhone(lidJid) {
  try {
    const url = `${WAHA_API_URL}/api/contacts?session=${encodeURIComponent(SESSION)}&contactId=${encodeURIComponent(lidJid)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-Api-Key': WAHA_API_KEY },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    // WAHA returns { id: "966XXXXXX@c.us", ... } when resolved
    if (data && data.id && data.id.endsWith('@c.us')) {
      return data.id.replace('@c.us', '');
    }
    return null;
  } catch (e) {
    return null;
  }
}

// messageId required for blue tick
async function markSeen(chatId, messageId) {
  return wahaApi('/api/sendSeen', 'POST', { session: SESSION, chatId, messageId });
}

async function startTyping(chatId) {
  return wahaApi('/api/startTyping', 'POST', { session: SESSION, chatId });
}

async function stopTyping(chatId) {
  return wahaApi('/api/stopTyping', 'POST', { session: SESSION, chatId });
}

async function sendMessage(chatId, text) {
  return wahaApi('/api/sendText', 'POST', { session: SESSION, chatId, text });
}

async function sendLocation(chatId, latitude, longitude, address) {
  return wahaApi('/api/sendLocation', 'POST', { session: SESSION, chatId, latitude, longitude, address });
}

module.exports = { markSeen, startTyping, stopTyping, sendMessage, sendLocation, resolveContactPhone };
