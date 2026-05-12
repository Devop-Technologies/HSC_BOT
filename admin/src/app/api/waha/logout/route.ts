import { NextResponse } from 'next/server';

const WAHA_URL = 'http://localhost:3000';

function getKey() {
  return process.env.WAHA_API_KEY || 'your-secret-key';
}

export async function POST() {
  try {
    const res = await fetch(WAHA_URL + '/api/sessions/default/logout', {
      method: 'DELETE',
      headers: { 'X-API-Key': getKey() },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
