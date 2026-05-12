import { NextResponse } from 'next/server';

const BOT_API = 'http://localhost:5000';

export async function GET() {
  try {
    const res = await fetch(`${BOT_API}/admin-webhook/system-prompt`, {
      headers: process.env.ADMIN_WEBHOOK_SECRET
        ? { 'x-admin-secret': process.env.ADMIN_WEBHOOK_SECRET }
        : {},
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { prompt_text } = body;

    if (!prompt_text || prompt_text.trim().length < 10) {
      return NextResponse.json({ error: 'prompt_text is required (min 10 chars)' }, { status: 400 });
    }

    const res = await fetch(`${BOT_API}/admin-webhook/system-prompt`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ADMIN_WEBHOOK_SECRET
          ? { 'x-admin-secret': process.env.ADMIN_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({ prompt_text: prompt_text.trim() }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
