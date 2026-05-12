const { pool } = require('../db');

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function purchasePackage({ customerId, packageId, source = 'bot', purchasePrice = null, discountPercent = 0, status = 'active', servicePriceOptionId = null, serviceDurationMinutes = null, serviceUnitPrice = null }, client = pool) {
  const pkgRes = await client.query(
    `SELECT id, name, total_sessions, total_price, validity_days, is_active
     FROM packages
     WHERE id = $1 AND COALESCE(is_active, true) = true`,
    [packageId]
  );
  const pkg = pkgRes.rows[0];
  if (!pkg) throw Object.assign(new Error('package_not_found'), { code: 'PACKAGE_NOT_FOUND' });

  const totalSessions = asNumber(pkg.total_sessions, 0);
  const price = purchasePrice === null || purchasePrice === undefined ? asNumber(pkg.total_price, 0) : asNumber(purchasePrice, 0);
  const validityDays = asNumber(pkg.validity_days, 0);
  const expiresExpr = `CASE WHEN $5::int > 0 THEN NOW() + ($5::int * INTERVAL '1 day') ELSE NULL END`;

  const walletRes = await client.query(
    `INSERT INTO customer_packages
       (customer_id, package_id, expires_at, status, total_sessions, remaining_sessions, purchase_price, discount_percent, source, service_price_option_id, service_duration_minutes, service_unit_price)
     VALUES ($1, $2, ${expiresExpr}, $8, $3, $3, $4, $6, $7, $9, $10, $11)
     RETURNING *`,
    [customerId, packageId, totalSessions, price, validityDays, asNumber(discountPercent, 0), source, status, servicePriceOptionId || null, serviceDurationMinutes || null, serviceUnitPrice === null || serviceUnitPrice === undefined ? null : asNumber(serviceUnitPrice, null)]
  );
  const wallet = walletRes.rows[0];

  await client.query(
    `INSERT INTO package_wallet_ledger
       (customer_package_id, customer_id, package_id, event_type, session_delta, balance_after, notes, pricing_snapshot)
     VALUES ($1, $2, $3, 'purchase', $4, $5, $6, $7::jsonb)`,
    [wallet.id, customerId, packageId, totalSessions, wallet.remaining_sessions, `Purchased ${pkg.name || 'package'}`, JSON.stringify({ purchase_price: price, package_name: pkg.name || null, service_price_option_id: servicePriceOptionId || null, service_duration_minutes: serviceDurationMinutes || null, service_unit_price: serviceUnitPrice || null })]
  );

  return wallet;
}

async function listCustomerPackages(customerId, client = pool) {
  const result = await client.query(
    `SELECT cp.*, p.name, p.description, p.total_sessions AS package_total_sessions, p.total_price, p.validity_days
     FROM customer_packages cp
     JOIN packages p ON p.id = cp.package_id
     WHERE cp.customer_id = $1
     ORDER BY cp.created_at DESC`,
    [customerId]
  );
  return result.rows;
}

async function getEligibleCustomerPackages({ customerId, serviceId, servicePriceOptionId = null }, client = pool) {
  const result = await client.query(
    `SELECT cp.*, p.name, p.description, p.total_price, p.validity_days,
            ps.service_id AS restricted_service_id,
            ps.service_price_option_id AS restricted_service_price_option_id,
            COALESCE(ps.discount_percent, cp.discount_percent, 0) AS effective_discount_percent
     FROM customer_packages cp
     JOIN packages p ON p.id = cp.package_id
     LEFT JOIN package_services ps
       ON ps.package_id = cp.package_id
      AND COALESCE(ps.is_active, true) = true
      AND (ps.service_id IS NULL OR ps.service_id = $2)
      AND (ps.service_price_option_id IS NULL OR ps.service_price_option_id = $3)
     WHERE cp.customer_id = $1
       AND cp.status = 'active'
       AND cp.remaining_sessions > 0
       AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
       AND (cp.service_price_option_id IS NULL OR cp.service_price_option_id = $3)
       AND (
         NOT EXISTS (SELECT 1 FROM package_services ps_any WHERE ps_any.package_id = cp.package_id AND COALESCE(ps_any.is_active, true) = true)
         OR ps.id IS NOT NULL
       )
     ORDER BY cp.expires_at ASC NULLS LAST, cp.created_at ASC`,
    [customerId, serviceId, servicePriceOptionId]
  );
  return result.rows;
}

async function reservePackageForBooking({ customerPackageId, bookingId, serviceId, servicePriceOptionId = null, pricingSnapshot = {}, notes = 'Reserved for booking' }, client = pool) {
  const walletRes = await client.query(
    `SELECT * FROM customer_packages
     WHERE id = $1 AND status = 'active' AND remaining_sessions > 0
       AND (expires_at IS NULL OR expires_at > NOW())
     FOR UPDATE`,
    [customerPackageId]
  );
  const wallet = walletRes.rows[0];
  if (!wallet) throw Object.assign(new Error('package_balance_unavailable'), { code: 'PACKAGE_BALANCE_UNAVAILABLE' });

  await client.query(
    `UPDATE bookings
     SET package_customer_id = $1,
         package_redemption_status = 'reserved',
         package_pricing_source = 'package'
     WHERE id = $2`,
    [customerPackageId, bookingId]
  );

  await client.query(
    `INSERT INTO package_wallet_ledger
       (customer_package_id, customer_id, package_id, booking_id, event_type, session_delta, balance_after, service_id, service_price_option_id, pricing_snapshot, notes)
     VALUES ($1, $2, $3, $4, 'reserve', 0, $5, $6, $7, $8::jsonb, $9)`,
    [wallet.id, wallet.customer_id, wallet.package_id, bookingId, wallet.remaining_sessions, serviceId || null, servicePriceOptionId || null, JSON.stringify(pricingSnapshot || {}), notes]
  );

  return wallet;
}

async function completePackageRedemption({ bookingId, notes = 'Completed booking redemption' }, client = pool) {
  const bookingRes = await client.query(
    `SELECT id, customer_id, package_customer_id, package_redemption_status, service_id, service_price_option_id, pricing_snapshot
     FROM bookings
     WHERE id = $1
     FOR UPDATE`,
    [bookingId]
  );
  const booking = bookingRes.rows[0];
  if (!booking?.package_customer_id) return null;
  if (booking.package_redemption_status === 'completed') return { alreadyCompleted: true, booking };

  const dup = await client.query(
    `SELECT id FROM package_wallet_ledger
     WHERE booking_id = $1 AND event_type = 'complete'
     LIMIT 1`,
    [bookingId]
  );
  if (dup.rows.length) return { alreadyCompleted: true, booking };

  const walletRes = await client.query(
    `SELECT * FROM customer_packages WHERE id = $1 FOR UPDATE`,
    [booking.package_customer_id]
  );
  const wallet = walletRes.rows[0];
  if (!wallet || wallet.status !== 'active' || Number(wallet.remaining_sessions) <= 0) {
    throw Object.assign(new Error('package_balance_unavailable'), { code: 'PACKAGE_BALANCE_UNAVAILABLE' });
  }

  const balanceAfter = Number(wallet.remaining_sessions) - 1;
  const nextStatus = balanceAfter <= 0 ? 'fully_used' : 'active';
  await client.query(
    `UPDATE customer_packages
     SET remaining_sessions = $1,
         status = $2,
         first_used_at = COALESCE(first_used_at, NOW()),
         updated_at = NOW()
     WHERE id = $3`,
    [balanceAfter, nextStatus, wallet.id]
  );

  await client.query(
    `UPDATE bookings
     SET package_redemption_status = 'completed', package_pricing_source = 'package'
     WHERE id = $1`,
    [bookingId]
  );

  await client.query(
    `INSERT INTO package_wallet_ledger
       (customer_package_id, customer_id, package_id, booking_id, event_type, session_delta, balance_after, service_id, service_price_option_id, pricing_snapshot, notes)
     VALUES ($1, $2, $3, $4, 'complete', -1, $5, $6, $7, $8::jsonb, $9)`,
    [wallet.id, wallet.customer_id, wallet.package_id, bookingId, balanceAfter, booking.service_id || null, booking.service_price_option_id || null, JSON.stringify(booking.pricing_snapshot || {}), notes]
  );

  return { customerPackageId: wallet.id, balanceAfter, status: nextStatus };
}

async function refundUnusedPackage({ customerPackageId, reason = 'Refund before first session' }, client = pool) {
  const walletRes = await client.query(
    `SELECT * FROM customer_packages WHERE id = $1 FOR UPDATE`,
    [customerPackageId]
  );
  const wallet = walletRes.rows[0];
  if (!wallet) throw Object.assign(new Error('customer_package_not_found'), { code: 'CUSTOMER_PACKAGE_NOT_FOUND' });
  if (wallet.first_used_at) throw Object.assign(new Error('package_already_used'), { code: 'PACKAGE_ALREADY_USED' });

  const used = await client.query(
    `SELECT id FROM package_wallet_ledger
     WHERE customer_package_id = $1 AND event_type = 'complete'
     LIMIT 1`,
    [customerPackageId]
  );
  if (used.rows.length) throw Object.assign(new Error('package_already_used'), { code: 'PACKAGE_ALREADY_USED' });

  await client.query(
    `UPDATE customer_packages
     SET status = 'refunded', refunded_at = NOW(), refund_reason = $2, updated_at = NOW()
     WHERE id = $1`,
    [customerPackageId, reason]
  );

  await client.query(
    `INSERT INTO package_wallet_ledger
       (customer_package_id, customer_id, package_id, event_type, session_delta, balance_after, notes)
     VALUES ($1, $2, $3, 'refund', 0, $4, $5)`,
    [wallet.id, wallet.customer_id, wallet.package_id, wallet.remaining_sessions, reason]
  );

  return { customerPackageId, refunded: true };
}

module.exports = {
  purchasePackage,
  listCustomerPackages,
  getEligibleCustomerPackages,
  reservePackageForBooking,
  completePackageRedemption,
  refundUnusedPackage,
};
