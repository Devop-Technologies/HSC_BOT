const { pool } = require('../db');

// ─── Time helpers ─────────────────────────────────────────────────────────────

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  // Handles past-midnight values (e.g. 1500 → 01:00)
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Format HH:MM → "1:00 PM"
function formatTime12h(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Format YYYY-MM-DD → "26 Feb (Thursday)"
function formatDateDisplay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const days   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} (${days[d.getUTCDay()]})`;
}

// ─── releaseExpiredHolds ──────────────────────────────────────────────────────
// Called at the top of every handleMessage() to clean stale holds

async function releaseExpiredHolds() {
  try {
    await pool.query(
      `DELETE FROM slot_holds WHERE status = 'held' AND expires_at < NOW()`
    );
  } catch (err) {
    console.error('[AVAIL] releaseExpiredHolds error:', err.message);
  }
}

// ─── generateTimeSlots ────────────────────────────────────────────────────────
// Returns array of "HH:MM" slot start times for the given location type and session duration

async function generateTimeSlots(locationType, durationMinutes) {
  const result = await pool.query(
    `SELECT open_time, close_time FROM business_hours
     WHERE service_type = $1 AND is_ramadan = false
     LIMIT 1`,
    [locationType]
  );
  if (!result.rows[0]) {
    console.warn(`[AVAIL] No business hours found for ${locationType} (is_ramadan: false)`);
    return [];
  }

  const { open_time, close_time } = result.rows[0];
  console.log(`[AVAIL] generateTimeSlots for ${locationType}: ${open_time} - ${close_time}`);
  let openMins  = timeToMinutes(open_time);
  let closeMins = timeToMinutes(close_time);

  // '00:00' close_time means midnight = end of business day
  if (closeMins === 0) closeMins = 1440;
  // Closing time crosses midnight (e.g. open=21:00, close=03:00 → 27:00)
  if (closeMins < openMins) closeMins += 1440;

  // Home visits need 30 min travel buffer between slots; center needs 15 min prep
  const duration    = Number(durationMinutes);  // ensure number, not string
  const travelBuffer = 15;
  const step   = duration + travelBuffer;
  const slots  = [];
  let current  = openMins;

  // Last slot must finish by closing time
  while (current + duration <= closeMins) {
    slots.push(minutesToTime(current));
    current += step;
  }
  return slots;
}

// ─── getAvailableProvider ─────────────────────────────────────────────────────
// Find the best therapist for a given service, date, and customer district.
//
// Per-provider district rule (one district per provider per day):
//   - EXCLUDE providers already locked to a DIFFERENT district today
//   - PREFER providers already locked to THIS district (consistent assignment)
//   - ALLOW providers with no lock yet today (they will get locked on booking confirm)
//   - If district is null → no district filter, any available provider
async function getAvailableProvider(serviceId, district, date, locationType) {
  const result = await pool.query(
    `SELECT id, name, rating FROM (
       SELECT DISTINCT t.id, t.full_name AS name, t.rating,
         CASE
           WHEN pdl.district = $3 THEN 0
           WHEN EXISTS (
             SELECT 1 FROM bookings b
             JOIN customer_locations cl ON cl.id = b.location_id
             WHERE b.therapist_id = t.id AND b.booking_date = $2 AND b.status != 'cancelled'
               AND b.location_type = 'home' AND cl.district IS NOT NULL AND cl.district = $3
           ) THEN 0
           ELSE 1
         END AS district_priority
       FROM therapists t
       JOIN therapist_services ts ON ts.therapist_id = t.id AND ts.service_id = $1
       LEFT JOIN provider_district_locks pdl ON pdl.therapist_id = t.id AND pdl.lock_date = $2
       WHERE t.is_active = true
         -- EXCLUDE if district lock points to a DIFFERENT district.
         -- When $3 is NULL (customer district unknown) only UNLOCKED providers are allowed —
         -- we cannot verify district compatibility, so locked providers are excluded.
         AND (pdl.district IS NULL OR ($3::text IS NOT NULL AND pdl.district = $3))
         -- EXCLUDE if has a home booking in a DIFFERENT known district.
         -- When $3 is NULL, any provider with a known-district home booking is excluded
         -- (same reason: district compatibility cannot be verified).
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           JOIN customer_locations cl ON cl.id = b.location_id
           WHERE b.therapist_id = t.id AND b.booking_date = $2
             AND b.status != 'cancelled'
             AND b.location_type = 'home'
             AND cl.district IS NOT NULL
             AND ($3::text IS NULL OR cl.district != $3)
         )
     ) sub
     ORDER BY district_priority ASC, rating DESC NULLS LAST`,
    [serviceId, date, district || null]
  );
  return result.rows;
}

// ─── getAvailableSlotsForDay ──────────────────────────────────────────────────
// Returns available "HH:MM" slots using range-based conflict checking.
//
// For each existing booking B (duration BD):
//   Occupied window = [B_start, B_start + BD + travelBuffer)
// A new slot S (duration D, travelBuffer T) is blocked if:
//   S < B_start + BD + T  (new slot starts before occupied window ends)
//   AND  S + D + T > B_start  (occupied window starts before new slot's window ends)

// skipHolds: pass true during revalidateTherapist — customers who already have a hold
// should not be blocked by other customers' overlapping holds. The final atomic DB
// transaction (confirmBookingAtomic) resolves any true race at write time.
// Default false: new customers browsing see holds as occupied (accurate availability).
async function getAvailableSlotsForDay(therapistId, serviceId, date, locationType, { skipHolds = false } = {}) {
  const svcResult = await pool.query(
    'SELECT duration_minutes FROM services WHERE id = $1',
    [serviceId]
  );
  const duration  = Number(svcResult.rows[0]?.duration_minutes) || 60;
  const travelBuf = 15;

  const allSlots = await generateTimeSlots(locationType, duration);
  if (!allSlots.length) return [];

  // For today: time buffer (same logic below applies in both paths)
  const todayStr = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let minBookableMinutes = 0;
  if (date === todayStr) {
    const now = new Date();
    const riyadhMinutes = ((now.getUTCHours() + 3) % 24) * 60 + now.getUTCMinutes();
    minBookableMinutes = riyadhMinutes + 30;
  }

  // Standard conflict check for all bookings (must have a therapist assigned)
  if (!therapistId) return [];

  // Fetch existing bookings — use saved end_time if available, else fallback to duration calc
  const bookedResult = await pool.query(
    `SELECT b.start_time, b.end_time, COALESCE(s.duration_minutes, 60) AS booking_duration
     FROM bookings b
     LEFT JOIN services s ON s.id = b.service_id
     WHERE b.therapist_id = $1
       AND b.booking_date = $2
       AND b.status != 'cancelled'
       AND b.start_time IS NOT NULL`,
    [therapistId, date]
  );

  // Fetch active holds WITH their service durations (skip when revalidating)
  let heldRows = [];
  if (!skipHolds) {
    const heldResult = await pool.query(
      `SELECT sh.slot_time AS start_time, NULL AS end_time, COALESCE(s.duration_minutes, 60) AS booking_duration
       FROM slot_holds sh
       LEFT JOIN services s ON s.id = sh.service_id
       WHERE sh.therapist_id = $1
         AND sh.slot_date = $2
         AND sh.status = 'held'
         AND sh.expires_at > NOW()`,
      [therapistId, date]
    );
    heldRows = heldResult.rows;
  }

  // Build occupied windows:
  // If end_time saved in DB → use end_time + travelBuf
  // Otherwise → start_time + booking_duration + travelBuf
  const occupiedWindows = [...bookedResult.rows, ...heldRows].map(r => {
    const startMins = timeToMinutes(String(r.start_time).substring(0, 5));
    const endMins   = r.end_time
      ? timeToMinutes(String(r.end_time).substring(0, 5))
      : startMins + Number(r.booking_duration);
    return {
      start: startMins,
      end:   endMins + travelBuf,
    };
  });



  return allSlots.filter(slot => {
    const slotStart = timeToMinutes(slot);
    const slotEnd   = slotStart + duration + travelBuf;  // new slot's occupied window end

    // Skip past/too-soon slots for today
    if (date === todayStr && slotStart < minBookableMinutes) return false;

    // Available only if no overlap with any existing occupied window
    return !occupiedWindows.some(w => slotStart < w.end && slotEnd > w.start);
  });
}

// ─── findNextAvailableDay ─────────────────────────────────────────────────────
// Scan up to maxDays from fromDate; returns first day with open slots,
// or null if none found

// customerLat / customerLng — optional, passed for home bookings to enable nearest-district logic
async function findNextAvailableDay(serviceId, district, locationType, fromDate, maxDays = 14, customerLat = null, customerLng = null) {
  const start = new Date(`${fromDate}T00:00:00Z`);
  console.log(`[AVAIL] findNextAvailableDay — serviceId:${serviceId} district:${district} type:${locationType} from:${fromDate} lat:${customerLat} lng:${customerLng}`);

  for (let i = 0; i < maxDays; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    const searchDistrict = locationType === 'center' ? 'Khaleej' : district;
    const providers = await getAvailableProvider(serviceId, searchDistrict, dateStr, locationType);
    if (!providers.length) {
      console.log(`[AVAIL]   ${dateStr} — no candidate providers found`);
      continue;
    }

    for (const p of providers) {
      const slots = await getAvailableSlotsForDay(p.id, serviceId, dateStr, locationType);
      if (slots.length > 0) {
        console.log(`[AVAIL]   ${dateStr} — picked: ${p.name} (slots: ${slots.length})`);
        return {
          date:          dateStr,
          dateDisplay:   formatDateDisplay(dateStr),
          therapistId:   p.id,
          therapistName: p.name,
          slots,
        };
      }
      console.log(`[AVAIL]   ${dateStr} — provider ${p.name} has 0 available slots`);
    }
    console.log(`[AVAIL]   ${dateStr} — checked ${providers.length} providers; all fully booked`);
  }
  return null;
}

// ─── lockDistrict ─────────────────────────────────────────────────────────────
// Write a district lock for a provider on a given date (kept for legacy compat)

async function lockDistrict(therapistId, date, district) {
  await pool.query(
    `INSERT INTO provider_district_locks (therapist_id, lock_date, district)
     VALUES ($1, $2, $3)
     ON CONFLICT (therapist_id, lock_date) DO NOTHING`,
    [therapistId, date, district]
  );
  console.log(`[LOCK] Therapist ${therapistId} locked to district "${district}" on ${date}`);
}

// ─── getDayDistrict ───────────────────────────────────────────────────────────
// Returns the district already booked for a given day (derived from existing
// confirmed bookings). No extra table needed.

async function getDayDistrict(date) {
  // First check provider_district_locks (explicitly written on booking confirm)
  const lockResult = await pool.query(
    `SELECT district FROM provider_district_locks WHERE lock_date = $1 LIMIT 1`,
    [date]
  );
  if (lockResult.rows[0]?.district) return lockResult.rows[0].district;

  // Fallback: derive from customer_locations on confirmed bookings
  const result = await pool.query(
    `SELECT cl.district
     FROM bookings b
     JOIN customer_locations cl ON cl.id = b.location_id
     WHERE b.booking_date = $1
       AND b.status != 'cancelled'
       AND cl.district IS NOT NULL
     LIMIT 1`,
    [date]
  );
  return result.rows[0]?.district || null;
}

// ─── checkDateAvailabilityDetails ─────────────────────────────────────────────
// Diagnostic function: returns detailed info about why a date is unavailable

async function checkDateAvailabilityDetails(serviceId, district, date, locationType) {
  console.log(`[DIAG] Checking availability details for ${date}, service: ${serviceId}, district: ${district}, type: ${locationType}`);

  // Get info on each candidate provider
  const providersResult = await pool.query(
    `SELECT t.id, t.full_name, pdl.district AS locked_district
     FROM therapists t
     JOIN therapist_services ts ON ts.therapist_id = t.id AND ts.service_id = $1
     LEFT JOIN provider_district_locks pdl ON pdl.therapist_id = t.id AND pdl.lock_date = $2
     WHERE t.is_active = true
     ORDER BY t.full_name`,
    [serviceId, date]
  );

  for (const p of providersResult.rows) {
    const isLockedToDifferent = district && p.locked_district && p.locked_district !== district;
    if (isLockedToDifferent) {
      console.log(`[DIAG]   - ${p.full_name}: LOCKED to ${p.locked_district} (different district conflict)`);
      continue;
    }

    const slots = await getAvailableSlotsForDay(p.id, serviceId, date, locationType);
    const status = slots.length > 0
      ? `✓ ${slots.length} slots available`
      : `✗ NO SLOTS AVAILABLE (day calendar is full)`;
    const lockedTag = p.locked_district ? ` [LOCKED to ${p.locked_district}]` : '';

    console.log(`[DIAG]   - ${p.full_name}: ${status}${lockedTag}`);
  }
}


// ─── holdSlot ─────────────────────────────────────────────────────────────────
// Atomically reserve a slot for a customer during the booking flow.
// The unique partial index (status='held') ensures only ONE customer can hold
// a given (therapist, date, time) — the second INSERT gets a unique_violation.
// Returns { ok: true } if hold acquired, { ok: false } if already held by someone else.
async function holdSlot(therapistId, serviceId, slotDate, slotTime, customerId, ttlMinutes = 10) {
  if (!therapistId) return { ok: true }; // no therapist assigned — nothing to hold
  try {
    // Release any previous hold this customer has for this therapist+date
    // (handles changing time within the same booking session)
    await pool.query(
      `UPDATE slot_holds SET status = 'released'
       WHERE customer_id = $1 AND therapist_id = $2 AND slot_date = $3 AND status = 'held'`,
      [customerId, therapistId, slotDate]
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await pool.query(
      `INSERT INTO slot_holds (therapist_id, service_id, slot_date, slot_time, customer_id, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'held', $6)`,
      [therapistId, serviceId || null, slotDate, slotTime, customerId, expiresAt]
    );
    return { ok: true };
  } catch (err) {
    if (err.code === '23505') return { ok: false }; // unique_violation — slot already held
    throw err;
  }
}

// ─── releaseHold ──────────────────────────────────────────────────────────────
// Release a customer's active hold after booking is confirmed (or on cancel).
async function releaseHold(customerId, therapistId, slotDate) {
  if (!customerId || !therapistId || !slotDate) return;
  await pool.query(
    `UPDATE slot_holds SET status = 'released'
     WHERE customer_id = $1 AND therapist_id = $2 AND slot_date = $3 AND status = 'held'`,
    [customerId, therapistId, slotDate]
  );
}

module.exports = {
  releaseExpiredHolds,
  generateTimeSlots,
  getAvailableProvider,
  getAvailableSlotsForDay,
  findNextAvailableDay,
  lockDistrict,
  getDayDistrict,
  checkDateAvailabilityDetails,
  formatDateDisplay,
  formatTime12h,
  holdSlot,
  releaseHold,
};
