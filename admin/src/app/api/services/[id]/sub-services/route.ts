import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [services, prices] = await Promise.all([
      pool.query(
        `select * from services
         where parent_id = $1
         order by sort_order asc nulls last, created_at asc`,
        [id]
      ),
      pool.query(
        `select spo.*
         from service_price_options spo
         join services s on s.id = spo.service_id
         where s.parent_id = $1
         order by spo.sort_order asc nulls last`,
        [id]
      ),
    ]);

    const priceMap: Record<string, unknown[]> = {};
    for (const row of prices.rows) {
      if (!priceMap[row.service_id]) priceMap[row.service_id] = [];
      priceMap[row.service_id].push(row);
    }

    return NextResponse.json(services.rows.map((row) => ({ ...row, price_options: priceMap[row.id] || [] })));
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load sub-services' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const service = await client.query(
      `insert into services (
        name, name_ar, description, icon, parent_id, sort_order, price, duration_minutes,
        oil_based, available_for_home, available_in_center, service_category, delivery_fee, is_active
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
      returning *`,
      [
        body.name,
        body.name_ar || null,
        body.description || null,
        body.icon || null,
        id,
        body.sort_order ?? 0,
        body.price ?? null,
        body.duration_minutes ?? null,
        body.oil_based ?? false,
        body.available_for_home ?? false,
        body.available_in_center ?? false,
        body.service_category ?? 'service',
        body.delivery_fee ?? null,
      ]
    );

    if (Array.isArray(body.price_options)) {
      for (const po of body.price_options) {
        if (po.price === null && po.duration_minutes === null) continue;
        await client.query(
          `insert into service_price_options
            (service_id, duration_minutes, price, delivery_fee, label, sort_order)
           values ($1,$2,$3,$4,$5,$6)`,
          [service.rows[0].id, po.duration_minutes ?? null, po.price ?? null, po.delivery_fee ?? null, po.label || null, po.sort_order ?? 0]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json(service.rows[0], { status: 201 });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create sub-service' }, { status: 500 });
  } finally {
    client.release();
  }
}
