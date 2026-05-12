import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// ─── GET: fetch rating info for public page ────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { rows } = await pool.query(
    `SELECT r.id,
            r.token,
            r.rating,
            r.comment,
            r.submitted_at,
            b.booking_date,
            b.start_time,
            b.end_time,
            t.full_name AS therapist_name,
            c.full_name AS customer_name,
            s.name AS service_name
       FROM ratings r
       LEFT JOIN bookings b ON b.id = r.booking_id
       LEFT JOIN therapists t ON t.id = r.therapist_id
       LEFT JOIN customer c ON c.id = r.customer_id
       LEFT JOIN services s ON s.id = b.service_id
      WHERE r.token = $1
      LIMIT 1`,
    [token]
  );

  const rating = rows[0];
  if (!rating) {
    return NextResponse.json({ error: 'Rating link not found' }, { status: 404 });
  }

  return NextResponse.json({
    token: rating.token,
    already_submitted: !!rating.submitted_at,
    existing_rating: rating.rating ?? null,
    booking_date: rating.booking_date instanceof Date ? rating.booking_date.toISOString().slice(0, 10) : rating.booking_date ?? null,
    start_time: rating.start_time ?? null,
    end_time: rating.end_time ?? null,
    therapist_name: rating.therapist_name ?? null,
    customer_name: rating.customer_name ?? null,
    service_name: rating.service_name ?? null,
  });
}

// ─── POST: submit rating ───────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const rating = Number(body?.rating);
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    const existingRes = await client.query(
      `SELECT id, submitted_at
         FROM ratings
        WHERE token = $1
        FOR UPDATE`,
      [token]
    );
    const existing = existingRes.rows[0];

    if (!existing) {
      await client.query('rollback');
      return NextResponse.json({ error: 'Rating link not found' }, { status: 404 });
    }

    if (existing.submitted_at) {
      await client.query('rollback');
      return NextResponse.json({ error: 'Rating already submitted' }, { status: 409 });
    }

    await client.query(
      `UPDATE ratings
          SET rating = $1,
              comment = $2,
              submitted_at = NOW()
        WHERE id = $3`,
      [rating, comment || null, existing.id]
    );

    await client.query('commit');
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query('rollback');
    const message = error instanceof Error ? error.message : 'Failed to submit rating';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
