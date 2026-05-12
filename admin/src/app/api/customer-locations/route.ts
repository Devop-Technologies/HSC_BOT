import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

type BookingRow = {
  location_id: string;
  booking_date: string | null;
  service_name: string | null;
};

export async function GET() {
  try {
    const [locationsRes, bookingsRes] = await Promise.all([
      pool.query(`
        SELECT cl.*, c.full_name AS customer_name, c.phone AS customer_phone
        FROM customer_locations cl
        LEFT JOIN customer c ON c.id = cl.customer_id
        ORDER BY cl.created_at DESC NULLS LAST
      `),
      pool.query(`
        SELECT b.location_id, b.booking_date, s.name AS service_name
        FROM bookings b
        LEFT JOIN services s ON s.id = b.service_id
        WHERE b.location_id IS NOT NULL
        ORDER BY b.booking_date DESC NULLS LAST, b.created_at DESC
      `),
    ]);

    const bookingMap = new Map<string, { booking_date: string | null; booking_service: string | null }>();
    for (const b of bookingsRes.rows as BookingRow[]) {
      if (!bookingMap.has(b.location_id)) {
        bookingMap.set(b.location_id, {
          booking_date: b.booking_date,
          booking_service: b.service_name,
        });
      }
    }

    const enriched = locationsRes.rows.map((loc) => ({
      ...loc,
      ...(bookingMap.get(loc.id) || { booking_date: null, booking_service: null }),
    }));

    return NextResponse.json(enriched);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load customer locations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
