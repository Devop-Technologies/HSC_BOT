import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logAction } from '@/lib/audit';

export async function GET() {
  try {
    const { rows } = await pool.query('SELECT * FROM human_agents ORDER BY created_at ASC');
    return NextResponse.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load human agents';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, phone_number } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!phone_number?.trim()) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });

  try {
    const { rows } = await pool.query(
      'INSERT INTO human_agents (name, phone_number) VALUES ($1,$2) RETURNING *',
      [name.trim(), phone_number.trim()]
    );
    const data = rows[0];

    void logAction({
      module: 'human_agent',
      action: 'created',
      entity_id: data.id,
      entity_label: data.name,
      details: { name: data.name, phone: data.phone_number },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const errorCode = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
    if (errorCode === '23505') return NextResponse.json({ error: 'This phone number is already registered.' }, { status: 409 });
    const message = err instanceof Error ? err.message : 'Failed to create human agent';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
