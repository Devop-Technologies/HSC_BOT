import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logAction } from '@/lib/audit';

type ServicePriceOptionRow = {
  id?: string;
  service_id: string;
  duration_minutes?: number | null;
  price?: number | null;
  delivery_fee?: number | null;
  label?: string | null;
  sort_order?: number | null;
};

type ServiceRow = {
  id: string;
  name?: string | null;
  service_category?: string | null;
  parent_id?: string | null;
  [key: string]: unknown;
};

type IncomingPriceOption = {
  duration_minutes?: number | null;
  price?: number | null;
  delivery_fee?: number | null;
  label?: string | null;
  sort_order?: number | null;
};

export async function GET() {
  try {
    const [servicesResult, pricesResult] = await Promise.all([
      pool.query('SELECT * FROM services ORDER BY sort_order ASC NULLS LAST, created_at ASC'),
      pool.query('SELECT * FROM service_price_options ORDER BY sort_order ASC NULLS LAST'),
    ]);

    const priceOptions: Record<string, ServicePriceOptionRow[]> = {};
    for (const p of pricesResult.rows as ServicePriceOptionRow[]) {
      if (!priceOptions[p.service_id]) priceOptions[p.service_id] = [];
      priceOptions[p.service_id].push(p);
    }

    const result = (servicesResult.rows as ServiceRow[]).map((s) => ({
      ...s,
      price_options: priceOptions[s.id] || [],
      children: [],
    }));

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load services';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    name,
    name_ar,
    description,
    icon,
    parent_id,
    sort_order,
    price,
    duration_minutes,
    oil_based,
    available_for_home,
    available_in_center,
    service_category,
    delivery_fee,
    price_options,
  } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertResult = await client.query(
      `INSERT INTO services (
        name, name_ar, description, icon, parent_id, sort_order, price, duration_minutes,
        oil_based, available_for_home, available_in_center, service_category, delivery_fee, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
      RETURNING *`,
      [
        name,
        name_ar || null,
        description || null,
        icon || null,
        parent_id || null,
        sort_order ?? 0,
        price ?? null,
        duration_minutes ?? null,
        oil_based ?? false,
        available_for_home ?? false,
        available_in_center ?? false,
        service_category ?? 'service',
        delivery_fee ?? null,
      ]
    );
    const data = insertResult.rows[0] as ServiceRow;

    if (Array.isArray(price_options) && price_options.length > 0) {
      const priceRows = (price_options as IncomingPriceOption[])
        .filter((po) => po.price !== null || po.duration_minutes !== null)
        .map((po) => [
          data.id,
          po.duration_minutes ?? null,
          po.price ?? null,
          po.delivery_fee ?? null,
          po.label || null,
          po.sort_order ?? 0,
        ]);

      for (const row of priceRows) {
        await client.query(
          `INSERT INTO service_price_options
            (service_id, duration_minutes, price, delivery_fee, label, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          row
        );
      }
    }

    await client.query('COMMIT');

    void logAction({
      module: 'service',
      action: 'created',
      entity_id: data.id,
      entity_label: typeof data.name === 'string' ? data.name : undefined,
      details: {
        name: data.name,
        category: data.service_category,
        parent_id: data.parent_id,
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Failed to create service';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
