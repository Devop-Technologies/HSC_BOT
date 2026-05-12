import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logAction } from '@/lib/audit';

type PriceOptionInput = {
  price?: number | string | null;
  duration_minutes?: number | string | null;
  delivery_fee?: number | string | null;
  label?: string | null;
  sort_order?: number | null;
};

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
    const updateFields = ALLOWED_FIELDS.filter((field) => body[field] !== undefined);
    let data: Record<string, unknown>;

    if (updateFields.length > 0) {
      const sets = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const values = updateFields.map((field) => body[field]);
      const result = await client.query(
        `UPDATE services SET ${sets} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      data = result.rows[0];
    } else {
      const result = await client.query('SELECT * FROM services WHERE id = $1', [id]);
      data = result.rows[0];
    }

    if (!data) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    if (Array.isArray(body.price_options)) {
      await client.query('DELETE FROM service_price_options WHERE service_id = $1', [id]);
      const priceRows = (body.price_options as PriceOptionInput[])
        .filter((po) => po.price !== null || po.duration_minutes !== null)
        .map((po) => [
          id,
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

    const action =
      body.is_active === true  ? 'activated'   :
      body.is_active === false ? 'deactivated' :
      'updated';

    void logAction({
      module: 'service',
      action,
      entity_id: id,
      entity_label: typeof data.name === 'string' ? data.name : undefined,
      details: action === 'updated' ? { changes: updateFields } : undefined,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Failed to update service';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await pool.query(
      `UPDATE services
       SET is_active = false
       WHERE id = $1
       RETURNING id, name, service_category`,
      [id]
    );
    const data = result.rows[0];

    if (!data) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    void logAction({
      module: 'service',
      action: 'deactivated',
      entity_id: id,
      entity_label: data.name,
      details: { reason: 'delete_endpoint_soft_deactivate', category: data.service_category },
    });

    return NextResponse.json({ deactivated: true, service: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to deactivate service';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
