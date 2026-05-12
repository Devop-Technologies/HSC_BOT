require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../db');
const { handleMessage } = require('../services/botHandler');

async function simulate() {
  const phone = '9665556666666';
  // Clean up test data in correct order
  const existing = await pool.query("SELECT id FROM customer WHERE phone = $1", [phone]);
  if (existing.rows.length > 0) {
    const cid = existing.rows[0].id;
    await pool.query("DELETE FROM bookings WHERE customer_id = $1", [cid]);
    await pool.query("DELETE FROM bot_sessions WHERE customer_id = $1", [cid]);
    await pool.query("DELETE FROM customer_locations WHERE customer_id = $1", [cid]);
    await pool.query("DELETE FROM whatsapp_logs WHERE customer_id = $1", [cid]);
    await pool.query("DELETE FROM customer WHERE id = $1", [cid]);
  }

  const steps = [
    ['Hi',              'greeting'],
    ['Layla',           'name'],
    ['2',               'book appointment'],
    ['11',              'select Sports Massage'],
    ['2',               'home visit'],
    ['Al Olaya dist',   'type address'],
    ['28 Feb',          'enter date'],
    ['Time change',     'CORRECTION: time keyword in time step'],
    ['5:30 PM',         'actual time'],
    ['date wrong set',  'CORRECTION: date in summary'],
    ['3 March',         'new date'],
    ['2:00 PM',         'new time'],
    ['what is this',    'unrecognized input'],
    ['yes',             'confirm booking'],
  ];

  for (const [msg, label] of steps) {
    process.stdout.write('[' + label + ']\n');
    process.stdout.write('User : ' + msg + '\n');
    const reply = await handleMessage(phone, msg);
    const preview = reply.replace(/\n/g, ' | ').substring(0, 100);
    process.stdout.write('Bot  : ' + preview + '\n\n');
  }

  await pool.end();
}

simulate().catch(e => { console.error(e.message); process.exit(1); });
