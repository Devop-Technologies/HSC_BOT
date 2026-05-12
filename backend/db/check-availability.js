// Run this to check why a specific date is not available for booking
// Usage: node db/check-availability.js <date> <serviceId>
// Example: node db/check-availability.js 2026-02-28 35da071b-fdaf-4f3e-9378-9f4eb4945876

const { pool } = require('../db');

async function checkAvailability(date, serviceId, district = 'Riyadh') {
  console.log(`\n📅 Checking availability for ${date}, Service: ${serviceId}, District: ${district}\n`);

  // 1. Check how many ACTIVE therapists exist
  const totalResult = await pool.query(
    'SELECT id, full_name, is_active, max_slots_per_day FROM therapists ORDER BY full_name'
  );
  const allTherapists = totalResult.rows;
  const activeTherapists = allTherapists.filter(t => t.is_active);
  console.log(`👥 Therapists in system: ${allTherapists.length} (${activeTherapists.length} active)\n`);

  // 2. Check how many offer THIS SERVICE
  const serviceResult = await pool.query(
    `SELECT DISTINCT t.id, t.full_name, t.max_slots_per_day, t.home_district
     FROM therapists t
     JOIN therapist_services ts ON ts.therapist_id = t.id
     WHERE ts.service_id = $1 AND t.is_active = true
     ORDER BY t.full_name`,
    [serviceId]
  );
  const serviceTherapists = serviceResult.rows;
  console.log(`💼 Therapists offering this service: ${serviceTherapists.length}`);
  
  if (serviceTherapists.length === 0) {
    console.log('   ❌ NO THERAPISTS OFFER THIS SERVICE!\n');
    await pool.end();
    return;
  }

  console.log('');

  // 3. For each therapist, check their status on the requested date
  for (const therapist of serviceTherapists) {
    console.log(`\n👤 ${therapist.full_name}`);
    console.log(`   Max slots/day: ${therapist.max_slots_per_day}`);
    console.log(`   Home district: ${therapist.home_district || 'N/A'}`);

    // Check bookings
    const bookingResult = await pool.query(
      `SELECT COUNT(*) as count, statuses
       FROM (
         SELECT status FROM bookings
         WHERE therapist_id = $1 AND booking_date = $2 AND status != 'cancelled'
       ) t
       GROUP BY status`,
      [therapist.id, date]
    );
    
    const bookings = await pool.query(
      `SELECT COUNT(*) as count FROM bookings
       WHERE therapist_id = $1 AND booking_date = $2 AND status != 'cancelled'`,
      [therapist.id, date]
    );
    const bookedCount = parseInt(bookings.rows[0]?.count || 0);

    // Check holds
    const holds = await pool.query(
      `SELECT COUNT(*) as count FROM slot_holds
       WHERE therapist_id = $1 AND slot_date = $2 AND status = 'held' AND expires_at > NOW()`,
      [therapist.id, date]
    );
    const heldCount = parseInt(holds.rows[0]?.count || 0);

    // Check district lock
    const lockResult = await pool.query(
      `SELECT district FROM provider_district_locks
       WHERE therapist_id = $1 AND lock_date = $2`,
      [therapist.id, date]
    );
    const districtLock = lockResult.rows[0];

    console.log(`   Bookings: ${bookedCount}, Held: ${heldCount} = ${bookedCount + heldCount} total recordings on this date`);

    if (districtLock) {
      console.log(`   ⛓️  LOCKED to: ${districtLock.district}`);
      if (district && districtLock.district !== district) {
        console.log(`      ⚠️  Locked to different district than requested (${district})`);
      }
    }

    // Since capacity check is removed, every active therapist matching district is potentially available
    if (!districtLock || (district && districtLock.district === district)) {
      console.log(`   ✅ POTENTIALLY AVAILABLE (Availability depends on time slots)`);
    } else {
      console.log(`   ❌ UNAVAILABLE (Locked to different district)`);
    }
  }

  console.log('\n---\n');
  await pool.end();
}

const date = process.argv[2] || '2026-02-28';
const serviceId = process.argv[3];

if (!serviceId) {
  console.log('❌ Usage: node db/check-availability.js <date> <serviceId>');
  console.log('   Example: node db/check-availability.js 2026-02-28 35da071b-fdaf-4f3e-9378-9f4eb4945876');
  process.exit(1);
}

checkAvailability(date, serviceId).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
