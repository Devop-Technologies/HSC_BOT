const https = require('https');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Converts lat/lng coordinates into a real street address using OpenStreetMap Nominatim.
// WhatsApp's own "description" field is often a landmark or area name — not reliable.
// Returns { displayName, district } — both may be null if geocoding fails.
async function reverseGeocode(lat, lng) {
  return new Promise((resolve) => {
    const path = `/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path,
      headers: {
        'User-Agent': 'WAHAWhatsAppBot/1.0',
        'Accept-Language': 'en',
      },
    };

    const req = https.get(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          const addr = json.address || {};
          const district =
            addr.suburb        ||
            addr.neighbourhood ||
            addr.quarter       ||
            addr.city_district ||
            addr.district      ||
            addr.residential   ||
            addr.county        ||
            null;
          const city =
            addr.city         ||
            addr.town         ||
            addr.village      ||
            addr.municipality ||
            null;
          const country = addr.country || null;
          resolve({ displayName: json.display_name || null, district, city, country });
        } catch {
          resolve({ displayName: null, district: null, city: null });
        }
      });
    });

    req.on('error', () => resolve({ displayName: null, district: null, city: null }));
    req.setTimeout(6000, () => { req.destroy(); resolve({ displayName: null, district: null, city: null }); });
  });
}

// Forward geocoding: address to lat/lng
async function geocode(address) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(address);
    const path = `/search?format=json&q=${encoded}&limit=1`;
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path,
      headers: {
        'User-Agent': 'WAHAWhatsAppBot/1.0',
        'Accept-Language': 'en',
      },
    };

    const req = https.get(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (json.length > 0) {
            const { lat, lon } = json[0];
            resolve({ lat: parseFloat(lat), lng: parseFloat(lon) });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(6000, () => { req.destroy(); resolve(null); });
  });
}

function isPersonalMessage(event) {
  return event.payload && event.payload.from && (event.payload.from.endsWith('@c.us') || event.payload.from.endsWith('@lid'));
}

// Keeps typing indicator alive every 4 sec (WhatsApp auto-stops it after ~5 sec)
function startTypingKeepalive(chatId, startTypingFn) {
  startTypingFn(chatId).catch(() => {});
  const interval = setInterval(() => {
    startTypingFn(chatId).catch(() => {});
  }, 4000);
  return interval;
}

function stopTypingKeepalive(intervalId) {
  clearInterval(intervalId);
}

// Normalize any phone number format to a clean WhatsApp ID (digits only, with country code).
// Handles: +966..., 966..., 0096..., 05XXXXXXXX, 5XXXXXXXX (Saudi mobile)
// Returns the digits string (e.g. "966537733745"), or null if input is empty.
function normalizeToWaId(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');        // strip all non-digits
  if (digits.startsWith('00966'))  digits = digits.slice(2);  // 00966X → 966X
  if (digits.startsWith('0966'))   digits = digits.slice(1);  // 0966X  → 966X
  if (digits.length === 10 && digits.startsWith('0')) digits = '966' + digits.slice(1); // 05X → 9665X
  if (digits.length === 9  && digits.startsWith('5')) digits = '966' + digits;          // 5X → 9665X
  return digits || null;
}

module.exports = { delay, isPersonalMessage, startTypingKeepalive, stopTypingKeepalive, reverseGeocode, geocode, normalizeToWaId };
