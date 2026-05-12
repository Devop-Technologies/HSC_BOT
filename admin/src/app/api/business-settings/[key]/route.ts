import { NextResponse } from 'next/server';

const BOT_API = 'http://localhost:5000';

const opts = (method?: string, body?: any): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(process.env.ADMIN_WEBHOOK_SECRET ? { 'x-admin-secret': process.env.ADMIN_WEBHOOK_SECRET } : {}) } as any,
  ...(body ? { body: JSON.stringify(body) } : {}),
});

async function updateBusinessSetting(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const body = await request.json();
    const { key } = await params;
    const res = await fetch(`${BOT_API}/admin-webhook/business-settings/${encodeURIComponent(key)}`, opts('PATCH', body));
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}

export const PATCH = updateBusinessSetting;
export const POST = updateBusinessSetting;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const res = await fetch(`${BOT_API}/admin-webhook/business-settings/${encodeURIComponent(key)}`, opts('DELETE'));
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
}
