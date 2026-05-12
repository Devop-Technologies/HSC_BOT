import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logAction } from '@/lib/audit';

const ALLOWED_FIELDS = ['name', 'phone_number', 'is_active'] as const;

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

  const fields = ALLOWED_FIELDS.filter((field) => update[field] !== undefined);
  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  try {
    const sets = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = fields.map((field) => update[field]);
    const { rows } = await pool.query(
      `UPDATE human_agents SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    const data = rows[0];
    if (!data) return NextResponse.json({ error: 'Human agent not found' }, { status: 404 });

    void logAction({
      module: 'human_agent',
      action: 'updated',
      entity_id: id,
      entity_label: data.name,
      details: { changes: fields },
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorCode = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
    if (errorCode === '23505') return NextResponse.json({ error: 'This phone number is already registered.' }, { status: 409 });
    const message = err instanceof Error ? err.message : 'Failed to update human agent';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { rows } = await pool.query(
      'UPDATE human_agents SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id, name',
      [id]
    );
    const data = rows[0];
    if (!data) return NextResponse.json({ error: 'Human agent not found' }, { status: 404 });

    void logAction({
      module: 'human_agent',
      action: 'deactivated',
      entity_id: id,
      entity_label: data.name ?? id,
      details: { reason: 'delete_endpoint_soft_deactivate' },
    });

    return NextResponse.json({ deactivated: true, human_agent: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to deactivate human agent';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
