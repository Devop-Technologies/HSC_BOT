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

async function listPackages(client: Pool | PoolClient = pool) {
  const packages = await client.query('select * from packages order by created_at asc');
  if (!packages.rows.length) return [];

  const packageIds = packages.rows.map((pkg) => pkg.id);
  const links = await client.query(
    'select * from package_services where package_id = any($1::uuid[]) and coalesce(is_active, true) = true order by created_at asc',
    [packageIds]
  );

  const serviceIds = [...new Set(links.rows.map((link) => link.service_id).filter(Boolean))];
  const [services, priceOptions] = serviceIds.length
    ? await Promise.all([
        client.query('select * from services where id = any($1::uuid[])', [serviceIds]),
        client.query('select * from service_price_options where service_id = any($1::uuid[]) order by sort_order asc', [serviceIds]),
      ])
    : [{ rows: [] }, { rows: [] }];

  const optionsByService = new Map<string, JsonRecord[]>();
  for (const option of priceOptions.rows) {
    if (!optionsByService.has(option.service_id)) optionsByService.set(option.service_id, []);
    optionsByService.get(option.service_id)!.push(option);
  }

  const serviceById = new Map<string, JsonRecord>();
  for (const service of services.rows) {
    serviceById.set(service.id, { ...service, price_options: optionsByService.get(service.id) || [] });
  }

  const linksByPackage = new Map<string, JsonRecord[]>();
  for (const link of links.rows) {
    if (!linksByPackage.has(link.package_id)) linksByPackage.set(link.package_id, []);
    linksByPackage.get(link.package_id)!.push({ ...link, service: serviceById.get(link.service_id) || null });
  }

  return packages.rows.map((pkg) => ({ ...pkg, service_links: linksByPackage.get(pkg.id) || [] }));
}

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

export async function GET() {
  try {
    return NextResponse.json(await listPackages());
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to load packages') }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json() as JsonRecord;
  const serviceLinks = (body.service_links || []) as PackageServiceInput[];

  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const inserted = await client.query(
      `insert into packages (name, description, total_sessions, total_price, validity_days, is_active)
       values ($1, $2, $3, $4, $5, true)
       returning *`,
      [
        body.name,
        body.description || null,
        body.total_sessions ?? null,
        body.total_price ?? null,
        body.validity_days ?? null,
      ]
    );
    await replacePackageServices(inserted.rows[0].id, serviceLinks, client);
    await client.query('commit');

    const packages = await listPackages();
    return NextResponse.json(packages.find((pkg) => pkg.id === inserted.rows[0].id) || inserted.rows[0], { status: 201 });
  } catch (err: unknown) {
    await client.query('rollback');
    return NextResponse.json({ error: asMessage(err, 'Failed to save package') }, { status: 500 });
  } finally {
    client.release();
  }
}
