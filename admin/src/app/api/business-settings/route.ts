import { NextResponse } from 'next/server';

const BOT_API = 'http://localhost:5000';

export async function GET() {
  try {
    const opts: RequestInit = {
      headers: {} as any,
    };
    if (process.env.ADMIN_WEBHOOK_SECRET) {
      (opts.headers as any)['x-admin-secret'] = process.env.ADMIN_WEBHOOK_SECRET;
    }
    const res = await fetch(`${BOT_API}/admin-webhook/business-settings`, opts);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const opts: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' } as any,
      body: JSON.stringify(body),
    };
    if (process.env.ADMIN_WEBHOOK_SECRET) {
      (opts.headers as any)['x-admin-secret'] = process.env.ADMIN_WEBHOOK_SECRET;
    }
    const res = await fetch(`${BOT_API}/admin-webhook/business-settings`, opts);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
