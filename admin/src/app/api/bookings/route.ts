import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

function compactDate(value: unknown) {
  return value ? String(value).slice(0, 10) : '';
}

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

    const bookings = bookingsRes.rows;
    const bookingIds = bookings.map((b) => b.id).filter(Boolean);
    const customerIds = [...new Set(bookings.map((b) => b.customer_id).filter(Boolean))];
    const locationIds = [...new Set(bookings.map((b) => b.location_id).filter(Boolean))];
    const therapistIds = [...new Set(bookings.map((b) => b.therapist_id).filter(Boolean))];
    const bookingDates = [...new Set(bookings.map((b) => compactDate(b.booking_date)).filter(Boolean))];

    const artifactByBooking = new Map<string, Record<string, unknown>>();
    if (bookingIds.length || customerIds.length || locationIds.length) {
      try {
        const artifactRes = await pool.query(
          `SELECT id, customer_id, booking_id, location_id, message_id, chat_id, created_at
             FROM customer_media_artifacts
            WHERE purpose = 'door_image'
              AND (
                booking_id = ANY($1::uuid[])
                OR location_id = ANY($2::uuid[])
                OR customer_id = ANY($3::uuid[])
              )
            ORDER BY created_at DESC`,
          [bookingIds, locationIds, customerIds]
        );

        for (const booking of bookings) {
          const artifact = artifactRes.rows.find((row) => row.booking_id === booking.id)
            ?? artifactRes.rows.find((row) => row.location_id && row.location_id === booking.location_id)
            ?? artifactRes.rows.find((row) => row.customer_id && row.customer_id === booking.customer_id);

          if (artifact) {
            artifactByBooking.set(booking.id, {
              door_image_artifact_id: artifact.id,
              door_image_message_id: artifact.message_id,
              door_image_chat_id: artifact.chat_id,
              door_image_created_at: artifact.created_at,
              door_image_match_source: artifact.booking_id === booking.id
                ? 'booking'
                : artifact.location_id && artifact.location_id === booking.location_id
                  ? 'location'
                  : 'customer',
            });
          }
        }
      } catch (artifactErr) {
        // Stage 6 visibility is best-effort: older schemas may not have the artifact table yet.
        console.warn('[admin/bookings] door-image artifact summary unavailable', artifactErr);
      }
    }

    const driverByBookingKey = new Map<string, Record<string, unknown>>();
    if (therapistIds.length && bookingDates.length) {
      try {
        const driverRes = await pool.query(
          `SELECT da.therapist_id, da.assignment_date, d.id, d.name, d.phone_number
             FROM driver_assignments da
             JOIN drivers d ON d.id = da.driver_id AND d.is_active = true
            WHERE da.therapist_id = ANY($1::uuid[])
              AND da.assignment_date = ANY($2::date[])`,
          [therapistIds, bookingDates]
        );

        for (const row of driverRes.rows) {
          driverByBookingKey.set(`${row.therapist_id}|${compactDate(row.assignment_date)}`, {
            driver_id: row.id,
            driver_name: row.name,
            driver_phone: row.phone_number,
          });
        }
      } catch (driverErr) {
        // Driver assignment tables are optional for older admin deployments.
        console.warn('[admin/bookings] driver reminder assignment summary unavailable', driverErr);
      }
    }

    const data = bookings.map((b) => ({
      ...b,
      ...(artifactByBooking.get(b.id) ?? {
        door_image_artifact_id: null,
        door_image_message_id: null,
        door_image_chat_id: null,
        door_image_created_at: null,
        door_image_match_source: null,
      }),
      ...(driverByBookingKey.get(`${b.therapist_id}|${compactDate(b.booking_date)}`) ?? {
        driver_id: null,
        driver_name: null,
        driver_phone: null,
      }),
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
