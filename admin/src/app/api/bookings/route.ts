import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const [bookingsRes, customersRes, therapistsRes, servicesRes, packagesRes, ratingsRes] =
      await Promise.all([
        pool.query('SELECT * FROM bookings ORDER BY booking_date DESC NULLS LAST, start_time DESC NULLS LAST, created_at DESC'),
        pool.query('SELECT id, full_name, phone FROM customer'),
        pool.query('SELECT id, full_name FROM therapists'),
        pool.query('SELECT id, name, name_ar FROM services'),
        pool.query('SELECT id, name FROM packages'),
        pool.query('SELECT booking_id, token, rating, submitted_at FROM ratings'),
      ]);

    const customerMap = Object.fromEntries(customersRes.rows.map((c) => [c.id, c]));
    const therapistMap = Object.fromEntries(therapistsRes.rows.map((t) => [t.id, t]));
    const serviceMap = Object.fromEntries(servicesRes.rows.map((s) => [s.id, s]));
    const packageMap = Object.fromEntries(packagesRes.rows.map((p) => [p.id, p]));
    const ratingMap = Object.fromEntries(ratingsRes.rows.map((r) => [r.booking_id, r]));

    const data = bookingsRes.rows.map((b) => ({
      ...b,
      customer: b.customer_id ? (customerMap[b.customer_id] ?? null) : null,
      therapist: b.therapist_id ? (therapistMap[b.therapist_id] ?? null) : null,
      service: b.service_id ? (serviceMap[b.service_id] ?? null) : null,
      package: b.package_id ? (packageMap[b.package_id] ?? null) : null,
      rating_token: ratingMap[b.id]?.token ?? null,
      rating_submitted: Boolean(ratingMap[b.id]?.submitted_at),
      rating_value: ratingMap[b.id]?.rating ?? null,
    }));

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load bookings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
