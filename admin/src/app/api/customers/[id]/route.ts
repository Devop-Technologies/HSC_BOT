import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const asMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export const runtime = 'nodejs';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [bookingsRes, therapistsRes, servicesRes, ratingsRes] = await Promise.all([
      pool.query(
        `select id, booking_date, start_time, end_time, status, payment_status, location_type, address,
                created_at, service_id, therapist_id, location_id
           from bookings
          where customer_id = $1
          order by booking_date desc nulls last, created_at desc`,
        [id]
      ),
      pool.query('select id, full_name from therapists'),
      pool.query('select id, name from services'),
      pool.query('select booking_id, rating, comment, submitted_at from ratings'),
    ]);

    const therapistMap = Object.fromEntries(therapistsRes.rows.map((t) => [t.id, t.full_name]));
    const serviceMap = Object.fromEntries(servicesRes.rows.map((s) => [s.id, s.name]));
    const ratingMap = Object.fromEntries(ratingsRes.rows.map((r) => [r.booking_id, r]));

    const history = bookingsRes.rows.map((b) => {
      const r = ratingMap[b.id];
      return {
        id: b.id,
        booking_date: b.booking_date,
        start_time: b.start_time,
        end_time: b.end_time,
        status: b.status,
        payment_status: b.payment_status,
        location_type: b.location_type,
        address: b.address,
        created_at: b.created_at,
        service_name: b.service_id ? (serviceMap[b.service_id] ?? null) : null,
        therapist_name: b.therapist_id ? (therapistMap[b.therapist_id] ?? null) : null,
        location_id: b.location_id ?? null,
        rating: r?.rating ?? null,
        rating_comment: r?.comment ?? null,
        rating_submitted: !!(r?.submitted_at),
      };
    });

    const completed = history.filter((b) => b.status === 'completed').length;
    const cancelled = history.filter((b) => b.status === 'cancelled').length;
    const rated = history.filter((b) => b.rating_submitted && b.rating != null);
    const avg_rating = rated.length
      ? Math.round((rated.reduce((sum, b) => sum + (b.rating ?? 0), 0) / rated.length) * 10) / 10
      : null;

    return NextResponse.json({
      history,
      stats: {
        total: history.length,
        completed,
        cancelled,
        avg_rating,
        rated_count: rated.length,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to load customer history') }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await pool.query('delete from customer where id = $1', [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    return NextResponse.json({ error: asMessage(err, 'Failed to delete customer') }, { status: 500 });
  }
}
