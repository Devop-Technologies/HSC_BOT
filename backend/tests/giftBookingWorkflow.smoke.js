const assert = require('assert');
const fs = require('fs');
const path = require('path');

const templates = require('../services/messageTemplates');

const baseSummary = {
  serviceName: 'Massage',
  duration: 60,
  price: 200,
  locationType: 'center',
  address: '',
  date: '2026-05-20',
  time: '3:00 PM',
  therapistName: 'Provider',
  deliveryFee: 0,
  discountPercent: 0,
};

const normal = templates.bookingSummary(baseSummary);
assert(!normal.includes('Gift details'), 'normal booking summary must not show gift metadata');
assert(normal.includes('Final total     :  200 SAR'), 'normal total should remain unchanged');

const giftDetails = {
  is_gift: true,
  recipient_name: 'Sara',
  instructions: 'Please say it is from Noura.',
  voucher_code: 'HSCGIFT',
};
const gift = templates.bookingSummary({ ...baseSummary, giftDetails });
assert(gift.includes('🎁 *Gift details*'), 'gift summary should show gift block');
assert(gift.includes('Recipient: Sara'), 'gift summary should show recipient');
assert(gift.includes('Voucher code: HSCGIFT'), 'gift summary should show voucher as metadata');
assert(gift.includes('Final total     :  200 SAR'), 'voucher metadata must not change pricing total');

const provider = templates.providerBookingNotification({
  serviceName: 'Massage',
  customerName: 'Customer',
  customerPhone: '966555555555',
  date: '2026-05-20',
  time: '3:00 PM',
  locationType: 'center',
  district: 'Khaleej',
  driverName: null,
  price: 200,
  giftDetails,
});
assert(provider.includes('🎁 *Gift details*'), 'provider notification should include gift block when present');
assert(provider.includes('Voucher code: HSCGIFT'), 'provider notification should include voucher metadata');

const ar = templates.forLang('ar');
const arPrompt = ar.askGiftDetails();
assert(arPrompt.includes('حجز هدية'), 'Arabic gift prompt should be available');
const arSummary = ar.bookingSummary({ ...baseSummary, giftDetails });
assert(arSummary.includes('🎁 *تفاصيل الهدية*'), 'Arabic summary should show gift block when present');

const bookingService = fs.readFileSync(path.join(__dirname, '../services/bookingService.js'), 'utf8');
assert(bookingService.includes('gift_details'), 'bookingService should persist gift_details when present');
assert(bookingService.includes('sanitizeGiftDetails'), 'bookingService should sanitize gift metadata');
assert(!bookingService.match(/voucher_code[\s\S]{0,160}(discount|finalTotal|serviceTotal)/), 'voucher code should not be wired into pricing logic');

const migration = fs.readFileSync(path.join(__dirname, '../db/migration_v2.sql'), 'utf8');
assert(migration.includes('ADD COLUMN IF NOT EXISTS gift_details JSONB'), 'migration should add bookings.gift_details JSONB');

console.log('giftBookingWorkflow.smoke: ok');
