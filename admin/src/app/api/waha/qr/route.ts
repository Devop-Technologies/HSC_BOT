import { NextResponse } from 'next/server';

const WAHA_URL = 'http://localhost:3000';

function getKey() {
  return process.env.WAHA_API_KEY || 'your-secret-key';
}

export async function GET() {
  try {
    const res = await fetch(WAHA_URL + '/api/screenshot?session=default', {
      headers: { 'X-API-Key': getKey() }
    });
    const blob = await res.blob();
    return new NextResponse(blob, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
