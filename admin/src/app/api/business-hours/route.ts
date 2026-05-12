import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query('SELECT * FROM business_hours ORDER BY service_type ASC NULLS LAST, is_ramadan ASC NULLS LAST');
    return NextResponse.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load business hours';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { service_type, is_ramadan, open_time, close_time } = body;

  if (!service_type) return NextResponse.json({ error: 'service_type is required' }, { status: 400 });

  try {
    const { rows } = await pool.query(
      'INSERT INTO business_hours (service_type, is_ramadan, open_time, close_time) VALUES ($1,$2,$3,$4) RETURNING *',
      [service_type, is_ramadan ?? false, open_time || null, close_time || null]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: unknown) {
    const errorCode = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
    const msg = errorCode === '23505'
      ? 'Hours for this service type and mode already exist'
      : err instanceof Error ? err.message : 'Failed to create business hours';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
