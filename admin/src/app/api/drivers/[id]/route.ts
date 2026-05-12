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
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name?.trim() || null;
  if (body.phone_number !== undefined) update.phone_number = body.phone_number?.trim() || null;
  if (body.is_active !== undefined) update.is_active = body.is_active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    if (update.is_active === false) {
      const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const activeJob = await pool.query(
        'select id from driver_assignments where driver_id = $1 and assignment_date = $2 limit 1',
        [id, today]
      );
      if (activeJob.rows[0]) {
        return NextResponse.json(
          { error: 'Driver is currently on a job today and cannot be deactivated.' },
          { status: 409 }
        );
      }
    }

    update.updated_at = new Date().toISOString();
    const fields = Object.keys(update);
    const values = fields.map((field) => update[field]);
    const sets = fields.map((field, idx) => `${field} = $${idx + 1}`);
    values.push(id);
    const { rows } = await pool.query(
      `update drivers set ${sets.join(', ')} where id = $${values.length} returning *`,
      values
    );
    const data = rows[0];
    if (!data) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });

    void logAction({
      module: 'driver',
      action: 'updated',
      entity_id: id,
      entity_label: data.name,
      details: { changes: Object.keys(update).filter((k) => k !== 'updated_at') },
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to update driver') }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const activeJob = await pool.query(
      'select id from driver_assignments where driver_id = $1 and assignment_date = $2 limit 1',
      [id, today]
    );
    if (activeJob.rows[0]) {
      return NextResponse.json(
        { error: 'Driver is currently on a job today and cannot be deactivated.' },
        { status: 409 }
      );
    }

    const result = await pool.query('update drivers set is_active = false, updated_at = now() where id = $1', [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to deactivate driver') }, { status: 500 });
  }
}
