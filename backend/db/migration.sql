-- ============================================================
-- Healing Space Center — Schema Migration
-- Run this in Supabase SQL Editor OR via node db/run-migration.js
-- ============================================================


-- ============================================================
-- STEP 1: FIX EXISTING TABLES (columns add karo)
-- ============================================================

-- 1.1 customer → last_active_at (returning customer detect karne ke liye)
ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT NOW();

-- 1.2 services → Arabic name
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS name_ar TEXT;

-- 1.3 services → service_category (single/package)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'single'
  CHECK (service_category IN ('single', 'package'));

-- 1.4 whatsapp_logs → customer_id FK
ALTER TABLE whatsapp_logs
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customer(id) ON DELETE SET NULL;

-- 1.5 bookings → location_id FK (customer_locations create hone ke baad)
--     (ye STEP 2 ke baad add hoga)


-- ============================================================
-- STEP 2: NEW TABLE — customer_locations
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  address      TEXT NOT NULL,
  neighborhood TEXT,
  city         TEXT DEFAULT 'Riyadh',
  is_default   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_default_location
  ON customer_locations(customer_id)
  WHERE is_default = TRUE;


-- ============================================================
-- STEP 3: bookings → location_id FK (after customer_locations exists)
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES customer_locations(id) ON DELETE SET NULL;


-- ============================================================
-- STEP 4: NEW TABLE — bot_sessions (CRITICAL for chatbot flow)
-- Steps: welcome → asking_name → services → service_detail →
--        booking_type → booking_date → booking_time →
--        location → confirm → done
-- ============================================================

CREATE TABLE IF NOT EXISTS bot_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  current_step TEXT NOT NULL DEFAULT 'welcome',
  session_data JSONB DEFAULT '{}',
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_session
  ON bot_sessions(customer_id);


-- ============================================================
-- STEP 5: auto-update updated_at for bot_sessions
-- ============================================================

CREATE OR REPLACE FUNCTION update_bot_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bot_sessions_updated ON bot_sessions;
CREATE TRIGGER trg_bot_sessions_updated
  BEFORE UPDATE ON bot_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_session_timestamp();


-- ============================================================
-- STEP 6: Services seed data (PDF se sab massage types)
-- ============================================================

INSERT INTO services (id, name, name_ar, description, oil_based, available_for_home, available_in_center, is_active, service_category)
VALUES
  (gen_random_uuid(), 'Hot Stone Massage',          'مساج الأحجار الحارة',   'Heated stones for deep relaxation',         TRUE,  TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Herbal Massage',             'مساج الأعشاب',          'Natural herbal compress massage',            TRUE,  TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Swedish Massage',            'المساج السويدي',         'Classic full-body relaxation massage',       TRUE,  TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Deep Tissue Massage',        'مساج الأنسجة العميقة',  'Targets deep muscle tension',               TRUE,  TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Trigger Point Therapy',      'مساج نقاط التحفيز',     'Oil-free targeted pressure points',          FALSE, TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Cupping Massage',            'مساج أكواب الهواء',     'Traditional cupping therapy',               FALSE, TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Thai Floor Massage',         'المساج التايلندي',      'Oil-free floor-based Thai massage',          FALSE, TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Prenatal Massage',           'مساج الحوامل',          'Safe massage post-first trimester',          TRUE,  TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Postnatal Massage',          'مساج ما بعد الولادة',   'Recovery massage after childbirth',          TRUE,  TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Bamboo Massage',             'مساج البامبو',          'Bamboo stick relaxation massage',            TRUE,  TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Cellulite Massage',          'مساج السيلوليت',        'Targets cellulite and improves circulation', TRUE,  TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Lymphatic Drainage Massage', 'المساج الليمفاوي',      'Boosts lymphatic system and detox',          TRUE,  TRUE,  TRUE, TRUE, 'single'),
  (gen_random_uuid(), 'Sports Massage',             'المساج الرياضي',        'For athletes and active women',              TRUE,  TRUE,  TRUE, TRUE, 'single')
ON CONFLICT DO NOTHING;


-- ============================================================
-- STEP 7: Packages seed data
-- ============================================================

INSERT INTO packages (id, name, description, total_sessions, total_price, validity_days, is_active)
VALUES
  (gen_random_uuid(), 'Pure Bliss Package',        'باقة الاسترخاء التام',    3, NULL, 90,  TRUE),
  (gen_random_uuid(), 'Wellness & Renewal Package','باقة العافية والتجديد',   5, NULL, 90,  TRUE),
  (gen_random_uuid(), 'Loyalty Package',           'باقة الولاء',             10, NULL, 180, TRUE)
ON CONFLICT DO NOTHING;


-- ============================================================
-- STEP 8: Business Hours seed data (from PDF)
-- ============================================================

INSERT INTO business_hours (id, service_type, is_ramadan, open_time, close_time)
VALUES
  (gen_random_uuid(), 'center', FALSE, '13:00', '22:00'),
  (gen_random_uuid(), 'center', TRUE,  '21:00', '03:00'),
  (gen_random_uuid(), 'home',   FALSE, '12:00', '00:00'),
  (gen_random_uuid(), 'home',   TRUE,  '20:00', '03:00')
ON CONFLICT DO NOTHING;


-- ============================================================
-- STEP 9: customer_locations → district column
-- ============================================================

ALTER TABLE customer_locations
  ADD COLUMN IF NOT EXISTS district TEXT;


-- ============================================================
-- STEP 10: Scheduling Engine — Availability Tables
-- ============================================================

-- 10.1 Extend therapists table
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS whatsapp_number   TEXT,
  ADD COLUMN IF NOT EXISTS rating            NUMERIC(3,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS home_address      TEXT,
  ADD COLUMN IF NOT EXISTS home_latitude     NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS home_longitude    NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS max_slots_per_day INT DEFAULT 6,
  ADD COLUMN IF NOT EXISTS is_active         BOOLEAN DEFAULT TRUE;

-- 10.2 Provider district locks (one district per therapist per day)
CREATE TABLE IF NOT EXISTS provider_district_locks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  lock_date    DATE NOT NULL,
  district     TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(therapist_id, lock_date)
);

-- 10.3 Slot holds (temporary reservation during confirmation)
CREATE TABLE IF NOT EXISTS slot_holds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  service_id   UUID REFERENCES services(id) ON DELETE SET NULL,
  slot_date    DATE NOT NULL,
  slot_time    TIME NOT NULL,
  customer_id  UUID REFERENCES customer(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'held' CHECK (status IN ('held', 'released')),
  expires_at   TIMESTAMP NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- 10.3b Day-level district lock (one district per day across all bookings)
CREATE TABLE IF NOT EXISTS day_district_locks (
  lock_date  DATE PRIMARY KEY,
  district   TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10.4 Add therapist_id to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL;

-- 10.4b Add end_time to bookings (calculated: start_time + service duration)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS end_time TIME;

-- 10.5 Seed production therapist
-- Keep only Shahad as the active provider. Old placeholder/test providers were removed.
INSERT INTO therapists (id, full_name, whatsapp_number, rating, home_address, max_slots_per_day, is_active)
VALUES
  ('cd89e75e-a2cb-46e4-b437-6966a11a124a', 'Shahad', '966505147575', 5.0, NULL, 6, TRUE)
ON CONFLICT DO NOTHING;

-- 10.6 Seed therapist_services
-- Shahad → all active services
INSERT INTO therapist_services (therapist_id, service_id)
SELECT 'cd89e75e-a2cb-46e4-b437-6966a11a124a', id FROM services WHERE is_active = true
ON CONFLICT DO NOTHING;


-- ============================================================
-- STEP 11: therapists → home_district (for district-match + nearest logic)
-- ============================================================

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS home_district TEXT;

-- Shahad location/district can be set from admin when confirmed.
UPDATE therapists SET home_district = NULL, home_latitude = NULL, home_longitude = NULL
  WHERE id = 'cd89e75e-a2cb-46e4-b437-6966a11a124a';


-- ============================================================
-- STEP 12: Add email column to customer and therapists
-- (Required for Google Calendar attendees)
-- ============================================================

ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS email TEXT;


-- ============================================================
-- STEP 13: bookings → calendar_event_id (Google Calendar event ID)
-- Used to update / delete the calendar event when booking changes
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;


-- ============================================================
-- STEP 14: Provider Rating
-- ============================================================

-- bookings: rating (1-5) + feedback text
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rating   INT CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS feedback TEXT;

-- therapists: running totals for avg rating calculation
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS total_bookings INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rating   INT DEFAULT 0;


-- ============================================================
-- STEP 15: driver_assignments
-- Driver locked to therapist per day (no district filtering needed).
-- One driver per therapist per day.
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  therapist_id     UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  assignment_date  DATE NOT NULL,
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(therapist_id, assignment_date)
);


-- ============================================================
-- DONE — Final Table List:
-- 1.  customer            (+ last_active_at)
-- 2.  services            (+ name_ar, service_category) + seeded
-- 3.  packages            (seeded)
-- 4.  package_services
-- 5.  therapists          (+ whatsapp_number, rating, home_address, max_slots_per_day, is_active) + seeded
-- 6.  therapist_services  (seeded)
-- 7.  business_hours      (seeded)
-- 8.  bookings            (+ location_id FK, therapist_id FK)
-- 9.  package_usage
-- 10. whatsapp_logs       (+ customer_id FK)
-- 11. customer_locations  [NEW]
-- 12. bot_sessions        [NEW — CRITICAL for chatbot]
-- 13. provider_district_locks [NEW]
-- 14. slot_holds          [NEW]
-- 15. day_district_locks  [NEW]
-- 16. slot_holds_active_unique index [NEW — prevents double-booking race]
-- ============================================================

-- 16. Prevent race-condition double-booking:
-- Only ONE customer can hold a given (therapist, date, time) at a time.
-- Partial index only covers active holds; released rows don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS slot_holds_active_unique
  ON slot_holds(therapist_id, slot_date, slot_time)
  WHERE status = 'held';


-- ============================================================
-- STEP 17: drivers → is_active (only active drivers get assigned)
-- ============================================================

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;


-- ============================================================
-- STEP 18: driver_assignments → district
-- Tracks which district each driver assignment covers.
-- Ensures a driver stays in one district per day.
-- ============================================================

ALTER TABLE driver_assignments
  ADD COLUMN IF NOT EXISTS district TEXT;
