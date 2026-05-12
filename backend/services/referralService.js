const crypto = require('crypto');
const { pool } = require('../db');
const { purchasePackage } = require('./packageWalletService');

const REFERRAL_THRESHOLD = 10;

function normalizeReferralCode(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function randomCode() {
  return `HSC${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function ensureReferralCode(customerId, client = pool) {
  const existing = await client.query(
    `SELECT code FROM referral_codes WHERE customer_id = $1 AND is_active = true LIMIT 1`,
    [customerId]
  );
  if (existing.rows[0]?.code) return existing.rows[0].code;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    try {
      const inserted = await client.query(
        `INSERT INTO referral_codes (customer_id, code)
         VALUES ($1, $2)
         ON CONFLICT (customer_id) DO UPDATE SET updated_at = now()
         RETURNING code`,
        [customerId, code]
      );
      return inserted.rows[0].code;
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw Object.assign(new Error('referral_code_generation_failed'), { code: 'REFERRAL_CODE_GENERATION_FAILED' });
}

async function hasCompletedBookingBefore({ customerId, beforeBookingId = null }, client = pool) {
  const values = [customerId];
  let excludeCurrent = '';
  if (beforeBookingId) {
    values.push(beforeBookingId);
    excludeCurrent = 'AND id <> $2';
  }
  const result = await client.query(
    `SELECT COUNT(*)::int AS completed_count
     FROM bookings
     WHERE customer_id = $1
       AND status = 'completed'
       ${excludeCurrent}`,
    values
  );
  return Number(result.rows[0]?.completed_count || 0) > 0;
}

async function getReferralStatus(customerId, client = pool) {
  const code = await ensureReferralCode(customerId, client);
  const [counts, rewards] = await Promise.all([
    client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
         COUNT(*) FILTER (WHERE status = 'qualified')::int AS qualified_count
       FROM referral_attributions
       WHERE referrer_customer_id = $1`,
      [customerId]
    ),
    client.query(
      `SELECT COUNT(*)::int AS awarded_count
       FROM referral_rewards
       WHERE referrer_customer_id = $1 AND status = 'awarded'`,
      [customerId]
    ),
  ]);
  const qualifiedCount = Number(counts.rows[0]?.qualified_count || 0);
  const awardedCount = Number(rewards.rows[0]?.awarded_count || 0);
  return {
    code,
    threshold: REFERRAL_THRESHOLD,
    pendingCount: Number(counts.rows[0]?.pending_count || 0),
    qualifiedCount,
    awardedCount,
    remainingToNextReward: Math.max(0, ((awardedCount + 1) * REFERRAL_THRESHOLD) - qualifiedCount),
  };
}

async function recordReferralCodeUse({ referredCustomerId, code }, client = pool) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return { ok: false, reason: 'missing_code' };

  const refCode = await client.query(
    `SELECT customer_id, code FROM referral_codes WHERE code = $1 AND is_active = true LIMIT 1`,
    [normalized]
  );
  const referrerCustomerId = refCode.rows[0]?.customer_id;
  if (!referrerCustomerId) return { ok: false, reason: 'code_not_found' };
  if (referrerCustomerId === referredCustomerId) return { ok: false, reason: 'self_referral' };

  if (await hasCompletedBookingBefore({ customerId: referredCustomerId }, client)) {
    return { ok: false, reason: 'returning_client' };
  }

  const existing = await client.query(
    `SELECT id, referrer_customer_id, status, referral_code
     FROM referral_attributions
     WHERE referred_customer_id = $1
     LIMIT 1`,
    [referredCustomerId]
  );
  if (existing.rows[0]) {
    return {
      ok: existing.rows[0].referrer_customer_id === referrerCustomerId,
      reason: 'already_attributed',
      attribution: existing.rows[0],
    };
  }

  const inserted = await client.query(
    `INSERT INTO referral_attributions
       (referrer_customer_id, referred_customer_id, referral_code, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [referrerCustomerId, referredCustomerId, normalized]
  );
  return { ok: true, reason: 'recorded', attribution: inserted.rows[0] };
}

async function getLoyaltyPackage(client = pool) {
  const pkg = await client.query(
    `SELECT id, name FROM packages
     WHERE COALESCE(is_active, true) = true AND name ILIKE '%loyalty%'
     ORDER BY created_at DESC
     LIMIT 1`
  );
  if (!pkg.rows[0]) throw Object.assign(new Error('loyalty_package_not_found'), { code: 'LOYALTY_PACKAGE_NOT_FOUND' });
  return pkg.rows[0];
}

async function countQualifiedReferrals(referrerCustomerId, client = pool) {
  const count = await client.query(
    `SELECT COUNT(*)::int AS qualified_count
     FROM referral_attributions
     WHERE referrer_customer_id = $1 AND status = 'qualified'`,
    [referrerCustomerId]
  );
  return Number(count.rows[0]?.qualified_count || 0);
}

async function maybeAwardLoyaltyReward(referrerCustomerId, client = pool) {
  const qualifiedCount = await countQualifiedReferrals(referrerCustomerId, client);
  const rewards = await client.query(
    `SELECT COUNT(*)::int AS awarded_count
     FROM referral_rewards
     WHERE referrer_customer_id = $1 AND status = 'awarded'`,
    [referrerCustomerId]
  );
  const awardedCount = Number(rewards.rows[0]?.awarded_count || 0);
  const nextThreshold = (awardedCount + 1) * REFERRAL_THRESHOLD;
  if (qualifiedCount < nextThreshold) {
    return { awarded: false, qualifiedCount, nextThreshold };
  }

  const pkg = await getLoyaltyPackage(client);
  const wallet = await purchasePackage({
    customerId: referrerCustomerId,
    packageId: pkg.id,
    source: 'referral_reward_auto',
    status: 'active',
    purchasePrice: 0,
    discountPercent: 100,
  }, client);

  const reward = await client.query(
    `INSERT INTO referral_rewards
       (referrer_customer_id, package_customer_id, threshold, qualified_count_snapshot, status)
     VALUES ($1, $2, $3, $4, 'awarded')
     RETURNING *`,
    [referrerCustomerId, wallet.id, REFERRAL_THRESHOLD, qualifiedCount]
  );

  return { awarded: true, qualifiedCount, nextThreshold, packageCustomerId: wallet.id, reward: reward.rows[0] };
}

async function qualifyReferralForBooking({ referredCustomerId, bookingId }, client = pool) {
  const attribution = await client.query(
    `SELECT * FROM referral_attributions
     WHERE referred_customer_id = $1 AND status = 'pending'
     LIMIT 1
     FOR UPDATE`,
    [referredCustomerId]
  );
  if (!attribution.rows[0]) return { qualified: false, reason: 'no_pending_referral' };

  if (await hasCompletedBookingBefore({ customerId: referredCustomerId, beforeBookingId: bookingId }, client)) {
    const rejected = await client.query(
      `UPDATE referral_attributions
       SET status = 'rejected', first_booking_id = $2, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [attribution.rows[0].id, bookingId]
    );
    return { qualified: false, reason: 'returning_client', attribution: rejected.rows[0] };
  }

  const updated = await client.query(
    `UPDATE referral_attributions
     SET status = 'qualified', first_booking_id = $2, qualified_at = now(), updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [attribution.rows[0].id, bookingId]
  );
  const award = await maybeAwardLoyaltyReward(updated.rows[0].referrer_customer_id, client);
  return { qualified: true, attribution: updated.rows[0], award };
}

async function claimLoyaltyRewardForSelection({ customerId, servicePriceOptionId = null, serviceDurationMinutes = null, serviceUnitPrice = null }, client = pool) {
  const status = await getReferralStatus(customerId, client);
  if (status.qualifiedCount < (status.awardedCount + 1) * REFERRAL_THRESHOLD && status.awardedCount <= 0) {
    return { ok: false, reason: 'not_enough_referrals', status };
  }

  const pkg = await getLoyaltyPackage(client);
  const existing = await client.query(
    `SELECT * FROM customer_packages
     WHERE customer_id = $1
       AND package_id = $2
       AND status = 'active'
       AND remaining_sessions > 0
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at ASC
     LIMIT 1`,
    [customerId, pkg.id]
  );
  if (existing.rows[0]) return { ok: true, existing: true, wallet: existing.rows[0], status };

  const award = await maybeAwardLoyaltyReward(customerId, client);
  if (!award.awarded) return { ok: false, reason: 'reward_already_used_or_not_available', status };

  if (servicePriceOptionId || serviceDurationMinutes || serviceUnitPrice !== null) {
    await client.query(
      `UPDATE customer_packages
       SET service_price_option_id = $2,
           service_duration_minutes = $3,
           service_unit_price = $4,
           updated_at = now()
       WHERE id = $1`,
      [award.packageCustomerId, servicePriceOptionId || null, serviceDurationMinutes || null, serviceUnitPrice === null || serviceUnitPrice === undefined ? null : Number(serviceUnitPrice)]
    );
  }
  const wallet = await client.query(`SELECT * FROM customer_packages WHERE id = $1`, [award.packageCustomerId]);
  return { ok: true, existing: false, wallet: wallet.rows[0], status: await getReferralStatus(customerId, client) };
}

module.exports = {
  REFERRAL_THRESHOLD,
  normalizeReferralCode,
  ensureReferralCode,
  getReferralStatus,
  recordReferralCodeUse,
  qualifyReferralForBooking,
  claimLoyaltyRewardForSelection,
};
