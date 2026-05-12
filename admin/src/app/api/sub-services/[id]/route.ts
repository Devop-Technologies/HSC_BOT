import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const ALLOWED_FIELDS = [
  'name', 'name_ar', 'description', 'icon', 'parent_id', 'sort_order',
  'price', 'duration_minutes', 'delivery_fee',
  'oil_based', 'available_for_home', 'available_in_center',
  'is_active', 'service_category',
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const fields = ALLOWED_FIELDS.filter((field) => body[field] !== undefined);
    let row;
    if (fields.length) {
      const sets = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
      const values = fields.map((field) => body[field]);
      const result = await client.query(`update services set ${sets} where id = $1 returning *`, [id, ...values]);
      row = result.rows[0];
    } else {
      const result = await client.query('select * from services where id = $1', [id]);
      row = result.rows[0];
    }

    if (!row) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Sub-service not found' }, { status: 404 });
    }

    if (Array.isArray(body.price_options)) {
      await client.query('delete from service_price_options where service_id = $1', [id]);
      for (const po of body.price_options) {
        if (po.price === null && po.duration_minutes === null) continue;
        await client.query(
          `insert into service_price_options
            (service_id, duration_minutes, price, delivery_fee, label, sort_order)
           values ($1,$2,$3,$4,$5,$6)`,
          [id, po.duration_minutes ?? null, po.price ?? null, po.delivery_fee ?? null, po.label || null, po.sort_order ?? 0]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json(row);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update sub-service' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = await pool.query('update services set is_active = false where id = $1 returning id, name', [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Sub-service not found' }, { status: 404 });
    return NextResponse.json({ deactivated: true, service: result.rows[0] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to deactivate sub-service' }, { status: 500 });
  }
}
