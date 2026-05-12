import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { Pool, PoolClient } from 'pg';

export const runtime = 'nodejs';

type JsonRecord = Record<string, unknown>;

interface PackageServiceInput {
  service_id?: string;
  sessions_allowed?: string | number | null;
  service_price_option_id?: string | null;
  discount_percent?: string | number | null;
}

const toNullableNumber = (value: unknown) => (
  value !== '' && value !== undefined && value !== null ? Number(value) : null
);

const asMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

async function replacePackageServices(packageId: string, serviceLinks: PackageServiceInput[], client: Pool | PoolClient = pool) {
  await client.query('update package_services set is_active = false where package_id = $1', [packageId]);

  const rows = (serviceLinks || []).filter((link) => Boolean(link.service_id));
  for (const link of rows) {
    await client.query(
      `insert into package_services
        (package_id, service_id, sessions_allowed, service_price_option_id, discount_percent, is_active)
       values ($1, $2, $3, $4, $5, true)`,
      [
        packageId,
        link.service_id,
        toNullableNumber(link.sessions_allowed),
        link.service_price_option_id || null,
        toNullableNumber(link.discount_percent),
      ]
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as JsonRecord;

  const fields = ['name', 'description', 'total_sessions', 'total_price', 'validity_days', 'is_active'];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const field of fields) {
    if (body[field] !== undefined) {
      values.push(body[field]);
      setClauses.push(`${field} = $${values.length}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    let updated = null;
    if (setClauses.length) {
      values.push(id);
      const result = await client.query(`update packages set ${setClauses.join(', ')} where id = $${values.length} returning *`, values);
      updated = result.rows[0] || null;
    } else {
      const result = await client.query('select * from packages where id = $1', [id]);
      updated = result.rows[0] || null;
    }

    if (!updated) {
      await client.query('rollback');
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    if (body.service_links !== undefined) {
      await replacePackageServices(id, (body.service_links || []) as PackageServiceInput[], client);
    }

    await client.query('commit');
    return NextResponse.json(updated);
  } catch (err: unknown) {
    await client.query('rollback');
    return NextResponse.json({ error: asMessage(err, 'Failed to update package') }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    await client.query('begin');
    await client.query('update package_services set is_active = false where package_id = $1', [id]);
    const result = await client.query('update packages set is_active = false where id = $1 returning id, is_active', [id]);
    await client.query('commit');

    if (!result.rows[0]) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    return NextResponse.json({ ok: true, id, is_active: false });
  } catch (err: unknown) {
    await client.query('rollback');
    return NextResponse.json({ error: asMessage(err, 'Failed to deactivate package') }, { status: 500 });
  } finally {
    client.release();
  }
}
