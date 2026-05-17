const Module = require('module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'pg') {
    class Pool {
      constructor() { this.query = async () => ({ rows: [] }); }
      on() {}
      connect() { return Promise.resolve({ release() {}, connectionParameters: { database: 'stub' } }); }
    }
    return { Pool };
  }
  if (request === 'node-cron') return { schedule() { return { stop() {} }; } };
  if (request === 'dotenv') return { config() { return {}; } };
  return originalLoad.apply(this, arguments);
};

const assert = require('assert');

const { pool } = require('../db');
const wahaService = require('../services/wahaService');
const mediaArtifactService = require('../services/mediaArtifactService');
const workerReminderService = require('../services/workerReminderService');

const calls = [];

pool.query = async (sql, params) => {
  if (String(sql).includes('UPDATE bookings')) {
    calls.push({ type: 'markSent', sql: String(sql), params });
    return { rows: [] };
  }
  throw new Error(`Unexpected DB query in smoke: ${String(sql).slice(0, 80)}`);
};

wahaService.sendMessage = async (chatId, text) => {
  calls.push({ type: 'sendMessage', chatId, text });
  return { id: 'text-message-id' };
};

let forwardShouldFail = false;
wahaService.forwardMessage = async (chatId, messageId) => {
  calls.push({ type: 'forwardMessage', chatId, messageId });
  if (forwardShouldFail) throw new Error('stub forward failure');
  return { id: 'forwarded-message-id' };
};

mediaArtifactService.getDoorImageArtifactForBooking = async ({ bookingId, customerId, locationId }) => {
  calls.push({ type: 'lookupDoorImage', bookingId, customerId, locationId });
  return { id: 'artifact-1', message_id: 'door-image-message-id' };
};

const booking = {
  id: '11111111-1111-4111-8111-111111111111',
  customer_id: '22222222-2222-4222-8222-222222222222',
  location_id: '33333333-3333-4333-8333-333333333333',
  booking_date: '2026-05-17',
  start_time: '10:00:00',
  location_type: 'home',
  provider_reminder_20m_sent_at: null,
  driver_reminder_20m_sent_at: null,
  service_name: 'Massage',
  customer_name: 'Client',
  customer_phone: '+966500000000',
  district: 'Al Khaleej',
  city: 'Riyadh',
  provider_name: 'Provider',
  provider_whatsapp: '+966511111111',
  driver_name: 'Driver',
  driver_phone: '+966522222222',
};

(async () => {
  const providerSent = await workerReminderService.sendProviderReminder(booking);
  assert.strictEqual(providerSent, true, 'provider reminder should be marked as sent');
  assert(calls.some(c => c.type === 'sendMessage' && c.chatId === '966511111111@c.us'), 'provider text reminder not sent');
  assert(calls.some(c => c.type === 'forwardMessage' && c.chatId === '966511111111@c.us' && c.messageId === 'door-image-message-id'), 'provider door image forward not invoked');
  assert(calls.some(c => c.type === 'markSent' && c.sql.includes('provider_reminder_20m_sent_at')), 'provider reminder not marked sent');

  forwardShouldFail = true;
  const driverSent = await workerReminderService.sendDriverReminder(booking);
  assert.strictEqual(driverSent, true, 'driver reminder should still be marked sent when image forward fails');
  assert(calls.some(c => c.type === 'sendMessage' && c.chatId === '966522222222@c.us'), 'driver text reminder not sent');
  assert(calls.some(c => c.type === 'forwardMessage' && c.chatId === '966522222222@c.us' && c.messageId === 'door-image-message-id'), 'driver door image forward not invoked');
  assert(calls.some(c => c.type === 'markSent' && c.sql.includes('driver_reminder_20m_sent_at')), 'driver reminder not marked sent after forward failure');

  console.log('workerReminderDoorForward smoke passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
