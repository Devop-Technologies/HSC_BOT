import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query('SELECT * FROM greetings ORDER BY id DESC');
    return NextResponse.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load greetings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { message_en, message_ar } = body;

  if (!message_en || !message_ar) {
    return NextResponse.json({ error: 'message_en and message_ar are required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE greetings SET is_active = false WHERE is_active = true');
    const { rows } = await client.query(
      'INSERT INTO greetings (message_en, message_ar, is_active) VALUES ($1,$2,true) RETURNING *',
      [message_en, message_ar]
    );
    await client.query('COMMIT');
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Failed to create greeting';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
