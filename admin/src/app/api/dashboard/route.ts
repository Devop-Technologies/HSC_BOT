import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

function isoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;

  const [bookingsRes, therapistsRes, customersRes, ratingsRes, servicesRes] = await Promise.all([
    pool.query(
      `SELECT id, booking_date, status, payment_status, customer_id, therapist_id, start_time, service_id, created_at
       FROM bookings
       ORDER BY created_at DESC NULLS LAST`
    ),
    pool.query('SELECT id, is_active FROM therapists'),
    pool.query('SELECT id, full_name FROM customer'),
    pool.query('SELECT id, submitted_at, therapist_id FROM ratings WHERE rating IS NOT NULL'),
    pool.query('SELECT id, name FROM services'),
  ]);

  const bookings = bookingsRes.rows;
  const therapists = therapistsRes.rows;
  const customers = customersRes.rows;
  const ratings = ratingsRes.rows;
  const services = servicesRes.rows;

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.full_name]));
  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s.name]));

  const todayBookings = bookings.filter((b) => isoDate(b.booking_date) === today).length;
  const yesterdayBookings = bookings.filter((b) => isoDate(b.booking_date) === yesterday).length;
  const activeProviders = therapists.filter((t) => t.is_active).length;
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const totalClients = customers.length;
  const newRatings = ratings.filter((r) => isoDate(r.submitted_at)?.startsWith(today.slice(0, 7))).length;

  const monthBookings = bookings.filter((b) => {
    const date = isoDate(b.booking_date);
    return date !== null && date >= monthStart;
  });
  const breakdown: Record<string, number> = {};
  for (const b of monthBookings) {
    const status = b.status ?? 'unknown';
    breakdown[status] = (breakdown[status] ?? 0) + 1;
  }

  const recent = bookings.slice(0, 8).map((b) => ({
    id: b.id,
    customer_name: b.customer_id ? (customerMap[b.customer_id] ?? 'Unknown') : 'Unknown',
    service_name: b.service_id ? (serviceMap[b.service_id] ?? '—') : '—',
    booking_date: isoDate(b.booking_date),
    start_time: b.start_time,
    status: b.status,
  }));

  const noShowCount = bookings.filter((b) => b.status === 'no_show').length;
  const unpaidCompleted = bookings.filter((b) => b.status === 'completed' && b.payment_status === 'unpaid').length;

  return NextResponse.json({
    stats: {
      today_bookings: todayBookings,
      today_change: todayBookings - yesterdayBookings,
      active_providers: activeProviders,
      total_providers: therapists.length,
      pending_count: pendingCount,
      total_clients: totalClients,
      new_ratings: newRatings,
    },
    breakdown,
    recent,
    attention: {
      pending_count: pendingCount,
      no_show_count: noShowCount,
      unpaid_completed: unpaidCompleted,
    },
  });
}
