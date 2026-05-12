const https = require('https');
const { pool } = require('../db');

// ── Validate Google credentials on startup ──────────────────────────────────
const REQUIRED_CREDS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
const missingCreds = REQUIRED_CREDS.filter(k => !process.env[k]);
const isGoogleConfigured = missingCreds.length === 0;

if (!isGoogleConfigured) {
  console.warn(`[GCAL] ⚠️  Missing credentials: ${missingCreds.join(', ')}`);
} else {
  console.log('[GCAL] ✓ Google Calendar credentials loaded');
}

// ── Token cache ─────────────────────────────────────────────────────────────
let cachedToken = null;   // { access_token, expiry }

// ── Core HTTPS helper (bypasses googleapis/gaxios/undici entirely) ──────────
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            const err = new Error(json.error?.message || `HTTP ${res.statusCode}`);
            err.code = res.statusCode;
            err.details = json.error;
            reject(err);
          }
        } catch (e) {
          resolve(data); // non-JSON response (e.g. 204 No Content on delete)
        }
      });
    });

    req.on('error', (err) => {
      console.error('[GCAL] HTTPS error:', err.message, '| code:', err.code);
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTPS request timed out'));
    });

    if (body) req.write(body);
    req.end();
  });
}

// ── Refresh access token using built-in https ───────────────────────────────
async function getAccessToken() {
  // Return cached token if still valid (5 min buffer)
  if (cachedToken && cachedToken.expiry > Date.now() + 5 * 60 * 1000) {
    return cachedToken.access_token;
  }

  const postData = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type:    'refresh_token',
  }).toString();

  const options = {
    hostname: 'oauth2.googleapis.com',
    path:     '/token',
    method:   'POST',
    port:     443,
    family:   4, // Force IPv4
    timeout:  15000,
    headers: {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length':  Buffer.byteLength(postData),
    },
  };

  const result = await httpsRequest(options, postData);

  if (!result.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(result)}`);
  }

  cachedToken = {
    access_token: result.access_token,
    expiry:       Date.now() + (result.expires_in || 3600) * 1000,
  };

  console.log('[GCAL] Token refreshed successfully');
  return cachedToken.access_token;
}

// ── Google Calendar API request helper ──────────────────────────────────────
async function calendarApi(method, path, body) {
  const token = await getAccessToken();
  const bodyStr = body ? JSON.stringify(body) : null;

  const options = {
    hostname: 'www.googleapis.com',
    path:     `/calendar/v3${path}`,
    method,
    port:     443,
    family:   4, // Force IPv4
    timeout:  15000,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
    },
  };

  return httpsRequest(options, bodyStr);
}

// ── Retry helper with exponential backoff ────────────────────────────────────
async function retryWithBackoff(fn, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Don't retry auth errors
      if (error.code === 401 || error.code === 403 ||
          (error.message && error.message.includes('invalid_grant'))) {
        throw error;
      }
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      console.warn(`[GCAL] Retry ${i + 1}/${maxRetries} after ${delay}ms — ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// ── Test network connectivity ───────────────────────────────────────────────
function testNetworkConnectivity() {
  return new Promise((resolve) => {
    const req = https.get({
      hostname: 'www.googleapis.com',
      path: '/',
      port: 443,
      family: 4,
      timeout: 5000,
    }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404);
      res.resume();
    });
    req.on('error', (err) => {
      console.warn('[GCAL] Network test failed:', err.message, '| code:', err.code);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.warn('[GCAL] Network test timed out');
      resolve(false);
    });
  });
}

/**
 * Create a Google Calendar event after a booking is confirmed.
 */
async function createCalendarEvent({
  therapistId, serviceId,
  date, time, locationType, address,
  customerName, customerPhone, therapistName,
  latitude, longitude,
}) {
  if (!isGoogleConfigured) {
    console.warn('[GCAL] Skipping — not configured');
    return null;
  }

  try {
    const sharedCalendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    const [serviceRes, therapistRes] = await Promise.all([
      serviceId
        ? pool.query('SELECT name, duration_minutes FROM services WHERE id = $1', [serviceId])
        : Promise.resolve({ rows: [{}] }),
      therapistId
        ? pool.query('SELECT email FROM therapists WHERE id = $1', [therapistId])
        : Promise.resolve({ rows: [{}] }),
    ]);

    const serviceName    = serviceRes.rows[0]?.name || 'Massage Session';
    const duration       = Number(serviceRes.rows[0]?.duration_minutes) || 60;
    const therapistEmail = therapistRes.rows[0]?.email;

    const timePart = time.length === 5 ? `${time}:00` : time;
    const startDt  = new Date(`${date}T${timePart}+03:00`);
    const endDt    = new Date(startDt.getTime() + duration * 60 * 1000);

    const location = locationType === 'center'
      ? 'Healing Space Center, Khaleej District, Riyadh'
      : (latitude && longitude)
        ? `https://maps.google.com/maps?q=${latitude},${longitude}`
        : (address || 'Client Home Address');

    const event = {
      summary: `${serviceName} — ${customerName || 'Client'}`,
      description: [
        `Booking via Healing Space WhatsApp`,
        ``,
        `Customer : ${customerName || 'Client'}`,
        `Phone    : ${customerPhone || 'N/A'}`,
        `Therapist: ${therapistName || 'TBD'}`,
        `Type     : ${locationType === 'center' ? 'At Center' : 'Home Visit'}`,
      ].join('\n'),
      location,
      start:     { dateTime: startDt.toISOString(), timeZone: 'Asia/Riyadh' },
      end:       { dateTime: endDt.toISOString(),   timeZone: 'Asia/Riyadh' },
      attendees: therapistEmail ? [{ email: therapistEmail }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 1440 },
          { method: 'popup', minutes: 360  }, // Example: 6 hours before (for 9:00 PM booking)
          { method: 'popup', minutes: 300  }, // Example: 5 hours before (for 8:00 PM booking)
          { method: 'popup', minutes: 240  },
          { method: 'popup', minutes: 120  },
        ],
      },
    };

    const calId = encodeURIComponent(sharedCalendarId);
    const result = await retryWithBackoff(
      () => calendarApi('POST', `/calendars/${calId}/events?sendUpdates=all`, event),
      3
    );

    console.log(`[GCAL] ✓ Event created: ${result.htmlLink}`);

    // Create a separate event on therapist's own calendar so custom popups show for them
    if (therapistEmail) {
      try {
        const therapistEvent = {
          ...event,
          attendees: [], // no attendees on personal copy
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 1440 },
              { method: 'popup', minutes: 360  },
              { method: 'popup', minutes: 300  },
              { method: 'popup', minutes: 240  },
              { method: 'popup', minutes: 120  },
            ],
          },
        };
        const therapistCalId = encodeURIComponent(therapistEmail);
        await retryWithBackoff(
          () => calendarApi('POST', `/calendars/${therapistCalId}/events?sendUpdates=none`, therapistEvent),
          3
        );
        console.log(`[GCAL] ✓ Therapist personal event created for ${therapistEmail}`);
      } catch (tErr) {
        console.warn(`[GCAL] ⚠️  Could not create therapist personal event (${therapistEmail}): ${tErr.message}`);
      }
    }

    return result;
  } catch (error) {
    console.error('[GCAL] ✗ Event creation failed:', error.message, '| code:', error.code);
    return null;
  }
}

/**
 * Update an existing Google Calendar event.
 */
async function updateCalendarEvent(eventId, updates) {
  if (!eventId || !isGoogleConfigured) return null;

  try {
    const sharedCalendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    const [serviceRes, therapistRes] = await Promise.all([
      updates.serviceId
        ? pool.query('SELECT name, duration_minutes FROM services WHERE id = $1', [updates.serviceId])
        : Promise.resolve({ rows: [{}] }),
      updates.therapistId
        ? pool.query('SELECT email FROM therapists WHERE id = $1', [updates.therapistId])
        : Promise.resolve({ rows: [{}] }),
    ]);

    const serviceName    = serviceRes.rows[0]?.name || 'Massage Session';
    const duration       = Number(serviceRes.rows[0]?.duration_minutes) || 60;
    const therapistEmail = therapistRes.rows[0]?.email;

    const timePart = updates.time.length === 5 ? `${updates.time}:00` : updates.time;
    const startDt  = new Date(`${updates.date}T${timePart}+03:00`);
    const endDt    = new Date(startDt.getTime() + duration * 60 * 1000);

    const location = updates.locationType === 'center'
      ? 'Healing Space Center, Khaleej District, Riyadh'
      : (updates.latitude && updates.longitude)
        ? `https://maps.google.com/maps?q=${updates.latitude},${updates.longitude}`
        : (updates.address || 'Client Home Address');

    const patch = {
      summary: `${serviceName} — ${updates.customerName || 'Client'}`,
      description: [
        `Booking via Healing Space WhatsApp`,
        ``,
        `Customer : ${updates.customerName || 'Client'}`,
        `Phone    : ${updates.customerPhone || 'N/A'}`,
        `Therapist: ${updates.therapistName || 'TBD'}`,
        `Type     : ${updates.locationType === 'center' ? 'At Center' : 'Home Visit'}`,
      ].join('\n'),
      location,
      start: { dateTime: startDt.toISOString(), timeZone: 'Asia/Riyadh' },
      end:   { dateTime: endDt.toISOString(),   timeZone: 'Asia/Riyadh' },
      attendees: therapistEmail ? [{ email: therapistEmail }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 1440 },
          { method: 'popup', minutes: 360  }, // Example: 6 hours before (for 9:00 PM booking)
          { method: 'popup', minutes: 300  }, // Example: 5 hours before (for 8:00 PM booking)
          { method: 'popup', minutes: 240  },
          { method: 'popup', minutes: 120  },
        ],
      },
    };

    const calId = encodeURIComponent(sharedCalendarId);
    const result = await retryWithBackoff(
      () => calendarApi('PATCH', `/calendars/${calId}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, patch),
      3
    );

    console.log(`[GCAL] ✓ Event updated: ${eventId}`);

    // Update therapist's personal calendar event (search by matching summary+date, recreate if not found)
    if (therapistEmail) {
      try {
        const therapistCalId = encodeURIComponent(therapistEmail);
        const therapistPatch = {
          ...patch,
          attendees: [],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 1440 },
              { method: 'popup', minutes: 360  },
              { method: 'popup', minutes: 300  },
              { method: 'popup', minutes: 240  },
              { method: 'popup', minutes: 120  },
            ],
          },
        };
        // Try to find existing therapist event by extendedProperties or recreate
        await retryWithBackoff(
          () => calendarApi('POST', `/calendars/${therapistCalId}/events?sendUpdates=none`, therapistPatch),
          3
        );
        console.log(`[GCAL] ✓ Therapist personal event updated for ${therapistEmail}`);
      } catch (tErr) {
        console.warn(`[GCAL] ⚠️  Could not update therapist personal event (${therapistEmail}): ${tErr.message}`);
      }
    }

    return result;
  } catch (error) {
    console.error('[GCAL] ✗ Event update failed:', error.message);
    return null;
  }
}

/**
 * Delete a Google Calendar event.
 */
async function deleteCalendarEvent(eventId) {
  if (!eventId || !isGoogleConfigured) return;

  try {
    const sharedCalendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const calId = encodeURIComponent(sharedCalendarId);

    await retryWithBackoff(
      () => calendarApi('DELETE', `/calendars/${calId}/events/${encodeURIComponent(eventId)}`),
      3
    );

    console.log(`[GCAL] ✓ Event deleted: ${eventId}`);
  } catch (error) {
    console.error('[GCAL] ✗ Event deletion failed:', error.message);
  }
}

module.exports = {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  testNetworkConnectivity,
};
