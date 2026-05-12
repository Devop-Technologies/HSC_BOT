import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

const asMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function buildUpdate(body: Record<string, unknown>, fields: string[]) {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of fields) {
    if (body[field] !== undefined) {
      values.push(body[field]);
      sets.push(`${field} = $${values.length}`);
    }
  }
  return { sets, values };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const { sets, values } = buildUpdate(body, ['service_type', 'is_ramadan', 'open_time', 'close_time']);

  if (!sets.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  try {
    values.push(id);
    const { rows } = await pool.query(
      `update business_hours set ${sets.join(', ')} where id = $${values.length} returning *`,
      values
    );
    if (!rows[0]) return NextResponse.json({ error: 'Business hours row not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error && 'code' in err && (err as { code?: string }).code === '23505'
      ? 'Hours for this service type and mode already exist'
      : asMessage(err, 'Failed to update business hours');
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await pool.query('delete from business_hours where id = $1', [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Business hours row not found' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to delete business hours') }, { status: 500 });
  }
}
