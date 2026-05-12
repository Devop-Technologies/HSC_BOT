import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logAction } from '@/lib/audit';

export const runtime = 'nodejs';

const asMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  const fields = ['status', 'payment_status', 'booking_date', 'start_time', 'end_time', 'therapist_id'];
  for (const field of fields) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const keys = Object.keys(update);
    const values = keys.map((field) => update[field]);
    const sets = keys.map((field, idx) => `${field} = $${idx + 1}`);
    values.push(id);
    const { rows } = await client.query(
      `update bookings set ${sets.join(', ')} where id = $${values.length} returning *`,
      values
    );
    const data = rows[0];
    if (!data) {
      await client.query('rollback');
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (update.status === 'completed' && data.therapist_id) {
      const token = crypto.randomUUID().replace(/-/g, '');
      await client.query(
        `insert into ratings (booking_id, token, therapist_id, customer_id)
         values ($1, $2, $3, $4)
         on conflict (booking_id) do update set
           token = excluded.token,
           therapist_id = excluded.therapist_id,
           customer_id = excluded.customer_id`,
        [id, token, data.therapist_id, data.customer_id ?? null]
      );
    }

    await client.query('commit');

    const isReschedule = !!(update.booking_date || update.start_time || update.end_time);
    if (update.status) {
      void logAction({ module: 'booking', action: 'status_changed', entity_id: id, entity_label: `Booking #${id.slice(0, 8)}`, details: { to: update.status } });
    } else if (update.payment_status) {
      const paymentAction = update.payment_status === 'paid' ? 'payment.paid' : update.payment_status === 'refunded' ? 'payment.refunded' : 'payment.pending';
      void logAction({ module: 'payment', action: paymentAction, entity_id: id, entity_label: `Booking #${id.slice(0, 8)}`, details: { payment_status: update.payment_status } });
    } else if (isReschedule) {
      void logAction({ module: 'booking', action: 'rescheduled', entity_id: id, entity_label: `Booking #${id.slice(0, 8)}`, details: { date: update.booking_date ?? null, start_time: update.start_time ?? null, end_time: update.end_time ?? null } });
    } else {
      void logAction({ module: 'booking', action: 'updated', entity_id: id, entity_label: `Booking #${id.slice(0, 8)}`, details: { changes: Object.keys(update) } });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    await client.query('rollback');
    return NextResponse.json({ error: asMessage(err, 'Failed to update booking') }, { status: 500 });
  } finally {
    client.release();
  }
}
