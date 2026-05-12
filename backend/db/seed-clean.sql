-- ============================================================
-- STEP 1: Duplicates clean karo
-- ============================================================

-- Services: duplicate rows remove (name same ho to ek rakhna)
DELETE FROM services
WHERE id NOT IN (
  SELECT MIN(id::text)::uuid
  FROM services
  GROUP BY name
);

-- Packages: duplicate rows remove
DELETE FROM packages
WHERE id NOT IN (
  SELECT MIN(id::text)::uuid
  FROM packages
  GROUP BY name
);

-- Business hours: duplicate rows remove
DELETE FROM business_hours
WHERE id NOT IN (
  SELECT MIN(id::text)::uuid
  FROM business_hours
  GROUP BY service_type, is_ramadan
);


-- ============================================================
-- STEP 2: UNIQUE constraints add (future duplicates rokne ke liye)
-- ============================================================

ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_name_unique,
  ADD CONSTRAINT services_name_unique UNIQUE (name);

ALTER TABLE packages
  DROP CONSTRAINT IF EXISTS packages_name_unique,
  ADD CONSTRAINT packages_name_unique UNIQUE (name);

ALTER TABLE business_hours
  DROP CONSTRAINT IF EXISTS bh_type_ramadan_unique,
  ADD CONSTRAINT bh_type_ramadan_unique UNIQUE (service_type, is_ramadan);


-- ============================================================
-- STEP 3: Services — PDF se poori info update karo
-- (oil_based, available_for_home, available_in_center, description, name_ar)
-- NOTE: price aur duration PDF mein nahi hain — baad mein fill hoga
-- ============================================================

UPDATE services SET
  name_ar = 'مساج الأحجار الحارة',
  description = 'Heated stones placed on body for deep relaxation and muscle tension relief',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Hot Stone Massage';

UPDATE services SET
  name_ar = 'مساج الأعشاب',
  description = 'Natural herbal compress massage for relaxation and rejuvenation',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Herbal Massage';

UPDATE services SET
  name_ar = 'المساج السويدي',
  description = 'Classic full-body relaxation massage using long gliding strokes',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Swedish Massage';

UPDATE services SET
  name_ar = 'مساج الأنسجة العميقة',
  description = 'Deep pressure massage targeting chronic muscle tension and knots',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Deep Tissue Massage';

UPDATE services SET
  name_ar = 'مساج نقاط التحفيز',
  description = 'Oil-free targeted pressure on specific trigger points to relieve pain',
  oil_based = FALSE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Trigger Point Therapy';

UPDATE services SET
  name_ar = 'مساج أكواب الهواء',
  description = 'Traditional cupping therapy to improve circulation and relieve tension',
  oil_based = FALSE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Cupping Massage';

UPDATE services SET
  name_ar = 'المساج التايلندي الأرضي',
  description = 'Oil-free floor-based Thai massage with assisted stretching techniques',
  oil_based = FALSE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Thai Floor Massage';

UPDATE services SET
  name_ar = 'مساج الحوامل',
  description = 'Safe and gentle massage for pregnant women — post-first trimester only',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Prenatal Massage';

UPDATE services SET
  name_ar = 'مساج ما بعد الولادة',
  description = 'Recovery and relaxation massage for mothers after childbirth',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Postnatal Massage';

UPDATE services SET
  name_ar = 'مساج البامبو',
  description = 'Relaxing massage using warm bamboo sticks to ease muscle tension',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Bamboo Massage';

UPDATE services SET
  name_ar = 'مساج السيلوليت',
  description = 'Targeted massage to reduce cellulite and improve skin circulation',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Cellulite Massage';

UPDATE services SET
  name_ar = 'المساج الليمفاوي',
  description = 'Gentle massage to stimulate lymphatic system, reduce swelling and detox',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Lymphatic Drainage Massage';

UPDATE services SET
  name_ar = 'المساج الرياضي',
  description = 'Sports massage for active women — injury prevention and muscle recovery',
  oil_based = TRUE, available_for_home = TRUE, available_in_center = TRUE,
  service_category = 'single'
WHERE name = 'Sports Massage';


-- ============================================================
-- STEP 4: Packages — PDF se info update karo
-- ============================================================

UPDATE packages SET
  name = 'Pure Bliss Package',
  description = 'باقة الاسترخاء التام — 3 sessions of your choice within 90 days',
  total_sessions = 3,
  validity_days = 90,
  is_active = TRUE
WHERE name = 'Pure Bliss Package';

UPDATE packages SET
  name = 'Wellness & Renewal Package',
  description = 'باقة العافية والتجديد — 5 sessions of your choice within 90 days',
  total_sessions = 5,
  validity_days = 90,
  is_active = TRUE
WHERE name = 'Wellness & Renewal Package';

UPDATE packages SET
  name = 'Loyalty Package',
  description = 'باقة الولاء — 10 sessions of your choice within 180 days',
  total_sessions = 10,
  validity_days = 180,
  is_active = TRUE
WHERE name = 'Loyalty Package';


-- ============================================================
-- STEP 5: Business Hours — Verify correct (already seeded)
-- Center:  1:00 PM – 10:00 PM  | Ramadan: 9:00 PM – 3:00 AM
-- Home:   12:00 PM – 12:00 AM  | Ramadan: 8:00 PM – 3:00 AM
-- ============================================================

UPDATE business_hours SET open_time = '13:00', close_time = '22:00'
WHERE service_type = 'center' AND is_ramadan = FALSE;

UPDATE business_hours SET open_time = '21:00', close_time = '03:00'
WHERE service_type = 'center' AND is_ramadan = TRUE;

UPDATE business_hours SET open_time = '12:00', close_time = '00:00'
WHERE service_type = 'home' AND is_ramadan = FALSE;

UPDATE business_hours SET open_time = '20:00', close_time = '03:00'
WHERE service_type = 'home' AND is_ramadan = TRUE;


-- ============================================================
-- VERIFICATION — Check final state
-- ============================================================

SELECT 'SERVICES COUNT' as check, COUNT(*) as total FROM services;
SELECT 'PACKAGES COUNT' as check, COUNT(*) as total FROM packages;
SELECT 'BUSINESS HOURS COUNT' as check, COUNT(*) as total FROM business_hours;
