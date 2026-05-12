import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

const asMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { rows } = await pool.query(
      `select id, created_at, message, direction
         from whatsapp_logs
        where customer_id = $1
        order by created_at asc`,
      [id]
    );

    return NextResponse.json(rows);
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to load customer chat') }, { status: 500 });
  }
}
