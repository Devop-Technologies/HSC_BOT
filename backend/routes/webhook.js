const express = require('express');
const router  = express.Router();

const { markSeen, startTyping, stopTyping, sendMessage, resolveContactPhone } = require('../services/wahaService');
const { handleMessage } = require('../services/botHandler');
const { logMessage } = require('../services/logService');
const { getOrCreateCustomer } = require('../services/customerService');
const { delay, isPersonalMessage, startTypingKeepalive, stopTypingKeepalive } = require('../utils/helpers');


// ─── Per-user message queue ───────────────────────────────────────────────────
// Prevents race conditions when WhatsApp sends multiple events simultaneously
// (e.g. location pin + auto-accompanying text/image).
// Messages from the same user are chained sequentially.
const userQueues = new Map();
const HUMAN_HANDOFF_HINT = `

Need help? Type *I want human* / *أريد موظف*.`;

function withHumanChoice(reply) {
  if (!reply || typeof reply !== 'string') return reply;
  if (reply.includes('I want human') || reply.includes('أريد موظف')) return reply;
  return `${reply}${HUMAN_HANDOFF_HINT}`;
}


function enqueue(phone, task) {
  const prev = userQueues.get(phone) || Promise.resolve();
  const next = prev.then(task).catch(() => {});
  userQueues.set(phone, next);
  // Clean up map entry once the chain is idle (avoid memory leak)
  next.finally(() => {
    if (userQueues.get(phone) === next) userQueues.delete(phone);
  });
}

router.post('/', async (req, res) => {
  res.status(200).json({ status: 'received' });

  const event = req.body;
  console.log("🚀 ~ req.body:", event.payload.body)
  if (event.event !== 'message') return;
  // if (event.payload.fromMe)      return; -- We need to log these!

  // Skip system/notification messages — not real user chat
  // const payloadType = event.payload.type || event.payload._data?.type || '';
  // if (payloadType === 'e2e_notification' || payloadType === 'notification_template') {
  //   console.log(`[SKIP] e2e_notification / system message ignored`);
  //   return;
  // }

  if (!isPersonalMessage(event)) {
    console.log('Ignored: group/broadcast message');
    return;
  }

  const fromMe  = event.payload.fromMe;
  const chatId  = fromMe ? event.payload.to : event.payload.from;
  const messageId = event.payload.id;

  // WhatsApp LID system: some users appear as "105046394060819@lid" instead of "966XXXXXXX@c.us"
  // Resolve to real phone number via WAHA contacts API
  let phone;
  if (chatId.endsWith('@lid')) {
    const resolved = await resolveContactPhone(chatId);
    if (resolved) {
      phone = resolved;
      console.log(`[LID] Resolved ${chatId} → ${phone}`);
    } else {
      // If WAHA cannot resolve the new WhatsApp LID, do not drop the customer's message.
      // Use the LID as a stable development customer identifier while replying to the original chatId.
      phone = chatId.replace('@lid', '');
      console.warn(`[LID] Could not resolve phone for ${chatId}; using LID fallback ${phone}`);
    }
  } else {
    phone = chatId.replace('@c.us', '');
  }
  
  // WAHA/WEBJS sometimes puts type in payload.type, sometimes only in payload._data.type
  const msgType = event.payload.type || event.payload._data?.type || 'text';


  // DEBUG: Log full payload to see exact WAHA structure
  console.log('[PAYLOAD]', JSON.stringify({
    type:     msgType,
    body:     typeof event.payload.body === 'string' ? event.payload.body.substring(0, 30) + '...' : event.payload.body,
    location: event.payload.location || null,
  }));

  // Reject voice / audio messages — not supported
  const isAudioMsg = msgType === 'audio' || msgType === 'ptt' || (event.payload.hasMedia && event.payload.media?.mimetype?.startsWith('audio/'));
  const isMedia = event.payload.hasMedia || ['image', 'video', 'document', 'sticker'].includes(msgType);

  if (isAudioMsg) {
    console.log(`[SKIP] ${phone}: voice message — not supported`);
    enqueue(phone, async () => {
      await markSeen(chatId, messageId);
      await sendMessage(chatId, `Voice and audio messages are not supported.\n\nPlease *type* your message and I will be happy to assist you.`);
    });
    return;
  }

  // Fast-fail for media without captions — avoid waiting for AI (slow)
  if (isMedia && !event.payload.caption) {
    console.log(`[SKIP] ${phone}: ${msgType} without caption — instant warning`);
    enqueue(phone, async () => {
      const typeLabel = 
        msgType === 'image' ? 'Images' :
        msgType === 'video' ? 'Videos' :
        msgType === 'document' ? 'Files' :
        msgType === 'sticker' ? 'Stickers' : 'Media files';
      
      await markSeen(chatId, messageId);
      await sendMessage(chatId, `I'm sorry, I'm unable to view ${typeLabel.toLowerCase()} at this time. Could you please *type* your request or question instead?`);
    });
    return;
  }

  let msgData;

  // Detect location: by type OR by presence of location object
  const locObj = event.payload.location;
  const isLocationMsg = msgType === 'location' || (locObj && (locObj.latitude || locObj.lat));

  if (isMedia) {
    const caption = event.payload.caption || '';
    // Normalize type labels for the bot to understand
    const label = msgType === 'image' ? '[Image]' :
                  msgType === 'video' ? '[Video]' :
                  msgType === 'document' ? '[File]' :
                  msgType === 'sticker' ? '[Sticker]' : `[${msgType}]`;
    
    msgData = {
      type: msgType,
      text: caption ? `${label} ${caption}` : label,
    };
    console.log(`[MEDIA] ${phone}: ${msgData.text}`);

  } else if (isLocationMsg && locObj) {
    // WAHA sends: { latitude, longitude, description } or { lat, lng, name, address }
    const lat  = locObj.latitude  ?? locObj.lat  ?? null;
    const lng  = locObj.longitude ?? locObj.lng  ?? null;
    // description is the standard WAHA field; fallback to name or address
    const name = locObj.description || locObj.name || locObj.address || '';

    msgData = {
      type:      'location',
      text:      '',
      latitude:  lat,
      longitude: lng,
      name,
      address:   name,
      maps_url:  lat ? `https://maps.google.com/?q=${lat},${lng}` : null,
    };
    console.log(`[LOC]  ${phone}: lat=${lat}, lng=${lng}, name="${name}"`);

  } else {
    // Text message — make sure body is not base64 image data
    const rawBody = event.payload.body || '';
    const isBase64 = rawBody.startsWith('/9j/') || rawBody.startsWith('iVBOR');

    msgData = {
      type: 'text',
      text: isBase64 ? '' : rawBody,   // ignore base64 thumbnail bodies
    };

    if (!isBase64) {
      console.log(`[IN]   ${phone}: ${msgData.text}`);
    } else {
      console.log(`[SKIP] ${phone}: base64 body ignored (map thumbnail)`);
    }
  }

  // Skip empty messages (e.g. base64-only with no real content)
  if (msgData.type === 'text' && !msgData.text.trim()) return;


  // Enqueue so messages from the same user are processed one at a time
  enqueue(phone, async () => {
    let typingInterval = null;
    try {
      // 1. Get customer and log message (incoming or mirrored outgoing)
      const { customer } = await getOrCreateCustomer(phone);
      const direction = fromMe ? 'outgoing' : 'incoming';
      const logText = msgData.type === 'location' ? `[Location] ${msgData.maps_url}` : msgData.text;

      if (logText) {
        await logMessage(phone, logText, direction, customer.id);
      }

      // If it's fromMe (manual therapist response or mirrored bot reply), we're done.
      if (fromMe) {
        if (logText) console.log(`[MIRROR] ${phone}: ${logText.substring(0, 50)}...`);
        return;
      }

      // 2. Process incoming message ──────────────────────────────────────────
      console.log(`[IN]     ${phone}: ${msgData.text.substring(0, 50)}...`);
      await delay(1000);
      await markSeen(chatId, messageId);

      typingInterval = startTypingKeepalive(chatId, startTyping);

      const reply = await handleMessage(phone, msgData);

      stopTypingKeepalive(typingInterval);
      await stopTyping(chatId);

      if (!reply) return; // provider message — silently ignore

      await sendMessage(chatId, withHumanChoice(reply));
      // NOTE: We don't log the reply directly here.
      // We rely on the WAHA mirror back (fromMe) event to log it.
      // This eliminates duplicates and captures manual responses too.

    } catch (err) {
      if (typingInterval) stopTypingKeepalive(typingInterval);
      console.error('Webhook error:', err.message);
      try {
        await sendMessage(chatId, 'Something went wrong. Please try again or contact us at +966551904178.');
      } catch (_) {}
    }
  });

});

module.exports = router;
