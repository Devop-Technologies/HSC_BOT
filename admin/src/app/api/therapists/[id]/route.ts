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
  const client = await pool.connect();

  const update: Record<string, unknown> = {};
  const fields = ['full_name', 'gender', 'whatsapp_number', 'email', 'is_licensed', 'is_active', 'max_slots_per_day', 'home_district', 'home_address', 'notes', 'rating'];
  for (const field of fields) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  try {
    await client.query('begin');

    if (Object.keys(update).length > 0) {
      const keys = Object.keys(update);
      const values = keys.map((field) => update[field]);
      const sets = keys.map((field, idx) => `${field} = $${idx + 1}`);
      values.push(id);
      await client.query(`update therapists set ${sets.join(', ')} where id = $${values.length}`, values);
    }

    if (body.service_ids !== undefined) {
      await client.query('delete from therapist_services where therapist_id = $1', [id]);
      const serviceIds = Array.isArray(body.service_ids) ? body.service_ids : [];
      for (const serviceId of serviceIds) {
        await client.query('insert into therapist_services (therapist_id, service_id) values ($1, $2)', [id, serviceId]);
      }
    }

    const { rows } = await client.query('select * from therapists where id = $1', [id]);
    const data = rows[0];
    if (!data) {
      await client.query('rollback');
      return NextResponse.json({ error: 'Therapist not found' }, { status: 404 });
    }

    await client.query('commit');

    const action = update.is_active === true ? 'activated' : update.is_active === false ? 'deactivated' : body.service_ids !== undefined ? 'services_updated' : 'updated';
    void logAction({
      module: 'provider',
      action,
      entity_id: id,
      entity_label: data.full_name,
      details: action === 'updated' ? { changes: Object.keys(update) } : action === 'services_updated' ? { service_count: Array.isArray(body.service_ids) ? body.service_ids.length : 0 } : undefined,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    await client.query('rollback');
    return NextResponse.json({ error: asMessage(err, 'Failed to update therapist') }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await pool.query('update therapists set is_active = false where id = $1', [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Therapist not found' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to deactivate therapist') }, { status: 500 });
  }
}
