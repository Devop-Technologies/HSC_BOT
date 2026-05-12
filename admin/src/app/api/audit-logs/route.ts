import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const PAGE_SIZE = 25;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const moduleFilter = searchParams.get('module') ?? '';
  const action = searchParams.get('action') ?? '';
  const offset = (page - 1) * PAGE_SIZE;

  const where: string[] = [];
  const values: string[] = [];
  if (moduleFilter) {
    values.push(moduleFilter);
    where.push(`module = $${values.length}`);
  }
  if (action) {
    values.push(action);
    where.push(`action = $${values.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const countRes = await pool.query(`SELECT count(*)::int AS count FROM audit_logs ${whereSql}`, values);
    const dataRes = await pool.query(
      `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, PAGE_SIZE, offset]
    );
    const total = countRes.rows[0]?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return NextResponse.json({ data: dataRes.rows, total, page, totalPages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load audit logs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
