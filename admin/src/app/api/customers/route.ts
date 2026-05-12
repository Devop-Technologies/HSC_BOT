import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

type CustomerLocationRow = { customer_id: string; [key: string]: unknown };

export async function GET() {
  try {
    const [customersRes, locationsRes] = await Promise.all([
      pool.query('SELECT * FROM customer ORDER BY created_at DESC NULLS LAST'),
      pool.query('SELECT * FROM customer_locations'),
    ]);

    const locationMap: Record<string, CustomerLocationRow[]> = {};
    for (const loc of locationsRes.rows as CustomerLocationRow[]) {
      if (!locationMap[loc.customer_id]) locationMap[loc.customer_id] = [];
      locationMap[loc.customer_id].push(loc);
    }

    const data = customersRes.rows.map((c) => ({
      ...c,
      customer_locations: locationMap[c.id] ?? [],
    }));

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load customers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
