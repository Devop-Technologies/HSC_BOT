import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

const asMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export async function GET() {
  try {
    const wallets = await pool.query('select * from customer_packages order by created_at desc limit 200');
    if (!wallets.rows.length) return NextResponse.json([]);

    const customerIds = [...new Set(wallets.rows.map((wallet) => wallet.customer_id).filter(Boolean))];
    const packageIds = [...new Set(wallets.rows.map((wallet) => wallet.package_id).filter(Boolean))];
    const walletIds = wallets.rows.map((wallet) => wallet.id);

    const [customers, packages, ledger] = await Promise.all([
      customerIds.length
        ? pool.query('select id, full_name, phone, email from customer where id = any($1::uuid[])', [customerIds])
        : Promise.resolve({ rows: [] }),
      packageIds.length
        ? pool.query('select id, name, total_sessions, total_price, validity_days from packages where id = any($1::uuid[])', [packageIds])
        : Promise.resolve({ rows: [] }),
      walletIds.length
        ? pool.query(
            `select id, customer_package_id, booking_id, event_type, session_delta, balance_after, notes, created_at
             from package_wallet_ledger
             where customer_package_id = any($1::uuid[])
             order by created_at desc
             limit 500`,
            [walletIds]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const customerById = new Map(customers.rows.map((customer) => [customer.id, customer]));
    const packageById = new Map(packages.rows.map((pkg) => [pkg.id, pkg]));
    const ledgerByWallet = new Map<string, Record<string, unknown>[]>();
    for (const event of ledger.rows) {
      if (!ledgerByWallet.has(event.customer_package_id)) ledgerByWallet.set(event.customer_package_id, []);
      ledgerByWallet.get(event.customer_package_id)!.push(event);
    }

    return NextResponse.json(wallets.rows.map((wallet) => ({
      ...wallet,
      customer: customerById.get(wallet.customer_id) || null,
      package: packageById.get(wallet.package_id) || null,
      ledger: ledgerByWallet.get(wallet.id) || [],
    })));
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to load customer package wallets') }, { status: 500 });
  }
}
