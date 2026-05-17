const assert = require('assert');
const {
  resolveInstructionEntries,
  forwardServiceInstructions,
} = require('../services/serviceInstructionForwardService');

async function main() {
  const service = { id: 77, name: 'Relaxation Massage', name_ar: 'مساج استرخاء' };
  const config = {
    enabled: true,
    entries: [
      {
        service_id: 77,
        triggers: ['service_detail'],
        text: { ar: 'تعليمات قبل الجلسة', en: 'Before-session instructions' },
        messageIds: ['source-message-1', 'source-message-2'],
      },
      {
        service_key: 'unrelated-service',
        triggers: ['service_detail'],
        text: { ar: 'لا يجب أن ترسل' },
        messageIds: ['wrong-message'],
      },
    ],
  };

  const matched = resolveInstructionEntries({ service, trigger: 'service_detail', lang: 'ar', config });
  assert.strictEqual(matched.length, 1, 'expected exactly one matched config entry');

  const calls = [];
  const waha = {
    sendMessage: async (chatId, text) => calls.push({ type: 'sendMessage', chatId, text }),
    forwardMessage: async (chatId, messageId) => calls.push({ type: 'forwardMessage', chatId, messageId }),
  };
  const stats = await forwardServiceInstructions({
    chatId: '966511111111@c.us',
    service,
    trigger: 'service_detail',
    lang: 'ar',
    config,
    waha,
  });

  assert.deepStrictEqual(stats, { attempted: 3, forwarded: 2, textSent: 1, errors: [] });
  assert.deepStrictEqual(calls, [
    { type: 'sendMessage', chatId: '966511111111@c.us', text: 'تعليمات قبل الجلسة' },
    { type: 'forwardMessage', chatId: '966511111111@c.us', messageId: 'source-message-1' },
    { type: 'forwardMessage', chatId: '966511111111@c.us', messageId: 'source-message-2' },
  ]);

  const failing = {
    sendMessage: async () => { throw new Error('text down'); },
    forwardMessage: async () => { throw new Error('forward down'); },
  };
  const failedStats = await forwardServiceInstructions({
    chatId: '966511111111@c.us',
    service,
    trigger: 'service_detail',
    lang: 'ar',
    config,
    waha: failing,
  });
  assert.strictEqual(failedStats.attempted, 3, 'failure path still attempts configured sends');
  assert.strictEqual(failedStats.textSent, 0, 'failed text should not count as sent');
  assert.strictEqual(failedStats.forwarded, 0, 'failed forwards should not count as forwarded');
  assert.strictEqual(failedStats.errors.length, 3, 'errors should be captured and non-throwing');

  const emptyStats = await forwardServiceInstructions({
    chatId: '966511111111@c.us',
    service: { id: 999, name: 'No mapping' },
    trigger: 'service_detail',
    lang: 'ar',
    config,
    waha,
  });
  assert.deepStrictEqual(emptyStats, { attempted: 0, forwarded: 0, textSent: 0, errors: [] });

  console.log('serviceInstructionForward smoke ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
