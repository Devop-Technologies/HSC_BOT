import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logAction } from '@/lib/audit';

type TherapistServiceRow = {
  therapist_id: string;
  service_id: string;
  name: string | null;
  name_ar: string | null;
  is_active: boolean | null;
};

type RatingRow = { therapist_id: string; rating: number };

export async function GET() {
  try {
    const [therapistsRes, tsRes, bookingsRes, ratingsRes] = await Promise.all([
      pool.query('SELECT * FROM therapists ORDER BY created_at ASC'),
      pool.query(`
        SELECT ts.therapist_id, ts.service_id, s.name, s.name_ar, s.is_active
        FROM therapist_services ts
        LEFT JOIN services s ON s.id = ts.service_id
      `),
      pool.query('SELECT therapist_id, status FROM bookings'),
      pool.query('SELECT therapist_id, rating FROM ratings WHERE rating IS NOT NULL'),
    ]);

    const serviceMap: Record<string, { service_id: string; name: string; name_ar: string | null; is_active: boolean | null }[]> = {};
    for (const row of tsRes.rows as TherapistServiceRow[]) {
      if (!serviceMap[row.therapist_id]) serviceMap[row.therapist_id] = [];
      const already = serviceMap[row.therapist_id].some((s) => s.service_id === row.service_id);
      if (!already) {
        serviceMap[row.therapist_id].push({
          service_id: row.service_id,
          name: row.name ?? '',
          name_ar: row.name_ar ?? null,
          is_active: row.is_active ?? null,
        });
      }
    }

    const bookingCounts: Record<string, number> = {};
    for (const b of bookingsRes.rows) {
      if (b.therapist_id) bookingCounts[b.therapist_id] = (bookingCounts[b.therapist_id] ?? 0) + 1;
    }

    const ratingStats: Record<string, { sum: number; count: number }> = {};
    for (const r of ratingsRes.rows as RatingRow[]) {
      if (!ratingStats[r.therapist_id]) ratingStats[r.therapist_id] = { sum: 0, count: 0 };
      ratingStats[r.therapist_id].sum += Number(r.rating);
      ratingStats[r.therapist_id].count += 1;
    }

    const data = therapistsRes.rows.map((t) => {
      const stats = ratingStats[t.id];
      return {
        ...t,
        services: serviceMap[t.id] ?? [],
        total_bookings: bookingCounts[t.id] ?? 0,
        ratings_count: stats?.count ?? 0,
        avg_rating: stats ? Math.round((stats.sum / stats.count) * 10) / 10 : null,
      };
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load therapists';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    full_name,
    gender,
    whatsapp_number,
    email,
    is_licensed,
    is_active,
    max_slots_per_day,
    home_district,
    home_address,
    notes,
    service_ids = [],
  } = body;

  if (!full_name) {
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO therapists
        (full_name, gender, whatsapp_number, email, is_licensed, is_active, max_slots_per_day, home_district, home_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        full_name,
        gender || null,
        whatsapp_number || null,
        email || null,
        is_licensed ?? false,
        is_active ?? true,
        max_slots_per_day ? Number(max_slots_per_day) : 6,
        home_district || null,
        home_address || null,
        notes || null,
      ]
    );
    const data = result.rows[0];

    for (const sid of service_ids as string[]) {
      await client.query('INSERT INTO therapist_services (therapist_id, service_id) VALUES ($1,$2)', [data.id, sid]);
    }

    await client.query('COMMIT');

    void logAction({
      module: 'provider',
      action: 'created',
      entity_id: data.id,
      entity_label: data.full_name,
      details: { name: data.full_name, phone: data.whatsapp_number, gender: data.gender, licensed: data.is_licensed },
    });

    return NextResponse.json({ ...data, service_ids }, { status: 201 });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Failed to create therapist';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
