import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

type WalletAction = 'activate' | 'void' | 'refund';

const asMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as { action?: WalletAction; reason?: string };
  const action = body.action;
  const reason = body.reason || 'Admin action';

  if (!action || !['activate', 'void', 'refund'].includes(action)) {
    return NextResponse.json({ error: 'action must be activate, void, or refund' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    const walletResult = await client.query('select * from customer_packages where id = $1 for update', [id]);
    const wallet = walletResult.rows[0];
    if (!wallet) {
      await client.query('rollback');
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const ledgerRows = await client.query('select id, event_type from package_wallet_ledger where customer_package_id = $1', [id]);

    if (action === 'refund') {
      const hasCompletedUse = Boolean(wallet.first_used_at) || ledgerRows.rows.some((event) => event.event_type === 'complete');
      if (hasCompletedUse) {
        await client.query('rollback');
        return NextResponse.json({ error: 'Cannot refund package after first completed session' }, { status: 409 });
      }
    }

    const nextStatus = action === 'activate' ? 'active' : action === 'void' ? 'void' : 'refunded';
    const result = action === 'refund'
      ? await client.query(
          `update customer_packages
           set status = $1, refunded_at = now(), refund_reason = $2, updated_at = now()
           where id = $3
           returning *`,
          [nextStatus, reason, id]
        )
      : await client.query(
          'update customer_packages set status = $1, updated_at = now() where id = $2 returning *',
          [nextStatus, id]
        );

    const ledgerType = action === 'activate' ? 'adjustment' : action;
    await client.query(
      `insert into package_wallet_ledger
        (customer_package_id, customer_id, package_id, event_type, session_delta, balance_after, notes)
       values ($1, $2, $3, $4, 0, $5, $6)`,
      [wallet.id, wallet.customer_id, wallet.package_id, ledgerType, wallet.remaining_sessions, reason]
    );

    await client.query('commit');
    return NextResponse.json(result.rows[0]);
  } catch (err: unknown) {
    await client.query('rollback');
    return NextResponse.json({ error: asMessage(err, 'Failed to update wallet') }, { status: 500 });
  } finally {
    client.release();
  }
}
