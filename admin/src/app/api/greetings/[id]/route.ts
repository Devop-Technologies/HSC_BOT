import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

const asMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const { message_en, message_ar, is_active } = body;
  const client = await pool.connect();

  try {
    await client.query('begin');
    if (is_active) {
      await client.query('update greetings set is_active = false where is_active = true');
    }
    const { rows } = await client.query(
      `update greetings
          set message_en = coalesce($1, message_en),
              message_ar = coalesce($2, message_ar),
              is_active = coalesce($3, is_active),
              updated_at = now()
        where id = $4
        returning *`,
      [message_en ?? null, message_ar ?? null, typeof is_active === 'boolean' ? is_active : null, id]
    );
    await client.query('commit');
    if (!rows[0]) return NextResponse.json({ error: 'Greeting not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    await client.query('rollback');
    return NextResponse.json({ error: asMessage(err, 'Failed to update greeting') }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const result = await pool.query('delete from greetings where id = $1', [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Greeting not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to delete greeting') }, { status: 500 });
  }
}
