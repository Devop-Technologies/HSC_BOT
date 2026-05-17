-- ============================================================
-- V2 Migration: System Prompts, Bot Messages, Delivery Fee, Locations
-- ============================================================

-- 1. System prompts table
CREATE TABLE IF NOT EXISTS system_prompts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Insert initial system prompt from planText.js
INSERT INTO system_prompts (prompt_text) VALUES (
'You are Sarah, a warm, polite, and patient receptionist at Healing Space Center — a premium women-only massage center in Riyadh, Saudi Arabia. You chat with clients on WhatsApp like a real human, not a robot.

Your tone must feel natural, friendly, and respectful. Be deeply patient and gentle, especially since many customers are older. Never blame the user, and show empathy if they seem confused. If they make a mistake, gently guide them without correcting harshly.

RULES:
- Reply in the SAME language the client uses. Arabic message → Arabic reply. English → English. Never mix.
- Use simple, clear language. Avoid technical words, long paragraphs, and bullet points unless strictly necessary.
- Keep replies conversational and short. Never sound robotic or scripted.
- Ask only one or two questions at a time.
- Gently guide the user step by step through their booking. If info is missing, ask politely.
- Repeat important details simply before confirming, and explain what happens next after booking.
- Only use information below. Never make anything up.

STYLE & EXAMPLES:
- Use warm phrases like: "No problem, I can help you with that", "Just to make sure I got it right...", "Take your time, I''m here to help", or "Let me handle that for you".
- Error handling: If you don''t understand, say: "I''m sorry, I didn''t quite catch that. Could you please tell me again?"'
) ON CONFLICT DO NOTHING;

-- 2. Bot messages table (for dynamic message templates)
CREATE TABLE IF NOT EXISTS bot_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  message_en TEXT NOT NULL,
  message_ar TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed default bot messages
INSERT INTO bot_messages (key, message_en, message_ar) VALUES
  ('welcome_new', 'Welcome to Healing Space Center\nPremium women-only massage — Riyadh\n\n"Expert in delivering exactly what you need to feel better."\n\nMay I have your name to get started?', 'مرحباً بك في هيلينج سبيس سنتر\nمساج نسائي فاخر — الرياض\n\n"خبراء في تقديم ما تحتاجينه للشعور بتحسن."\n\nما اسمك الكريم للبدء؟'),
  ('welcome_back', 'Welcome back, {name}!', 'أهلاً وسهلاً، {name}!'),
  ('main_menu', 'How can I help you today?\n\n1. View Our Services\n2. Book an Appointment\n3. Operating Hours\n4. FAQ\n5. Talk to a Human Agent', 'كيف يمكنني مساعدتك اليوم؟\n\n1. عرض خدماتنا\n2. حجز موعد\n3. ساعات العمل\n4. الأسئلة الشائعة\n5. التحدث مع موظف'),
  ('did_not_understand', 'I''m sorry, I didn''t quite catch that. Could you please try again?', 'عذراً، لم أفهم ذلك جيداً. هل يمكنك المحاولة مرة أخرى؟'),
  ('booking_confirmed', 'Booking Confirmed\n\nThank you, {name}. Your booking is confirmed.\n\nWe will be in touch shortly to finalize the details.', 'تم تأكيد الحجز\n\nشكراً، {name}. تم تأكيد حجزك.\n\nسنتواصل معك قريباً لتأكيد التفاصيل.'),
  ('booking_cancelled', 'Booking Cancelled\n\nNo problem at all — you can start a new booking anytime.', 'تم إلغاء الحجز\n\nلا مشكلة — يمكنك بدء حجز جديد في أي وقت.'),
  ('no_availability', 'Currently, all slots are full for the next 14 days. Please contact us at +966 55 190 4178.', 'نعتذر، جميع المواعيد محجوزة بالكامل للأسبوعين القادمين. يرجى التواصل معنا على +966 55 190 4178.')
ON CONFLICT DO NOTHING;

-- 3. Add delivery_fee to services table
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2);

-- 4. Add latitude/longitude/maps_url to customer_locations (some may already exist)
ALTER TABLE customer_locations
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS maps_url  TEXT;


-- Stage 2: customer media artifacts for forwardable WhatsApp message ids.
-- V1 stores the original provider-forwardable messageId; it does not download or
-- persist media bytes. New Supabase tables are used by the backend through direct
-- Postgres access, not automatically exposed through the Data API.
CREATE TABLE IF NOT EXISTS customer_media_artifacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
  location_id UUID REFERENCES customer_locations(id) ON DELETE SET NULL,
  message_id  TEXT NOT NULL UNIQUE,
  chat_id     TEXT,
  media_type  TEXT NOT NULL DEFAULT 'image',
  purpose     TEXT NOT NULL DEFAULT 'door_image',
  caption     TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_media_artifacts_customer_purpose
  ON customer_media_artifacts(customer_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_media_artifacts_booking
  ON customer_media_artifacts(booking_id)
  WHERE booking_id IS NOT NULL;

-- Stage 3: provider/driver T-minus-20 reminder idempotency markers.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS provider_reminder_20m_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS driver_reminder_20m_sent_at TIMESTAMP;


-- Stage 7: optional isolated gift booking metadata.
-- Voucher codes are stored as metadata only; pricing/package wallet semantics remain unchanged.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS gift_details JSONB;

CREATE INDEX IF NOT EXISTS idx_bookings_gift_details
  ON bookings USING GIN (gift_details)
  WHERE gift_details IS NOT NULL;
