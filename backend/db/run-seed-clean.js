require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

function splitSQL(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;

  for (const line of sql.split('\n')) {
    if (line.trim().startsWith('--')) continue;
    if (line.includes('$$')) inDollarQuote = !inDollarQuote;
    current += line + '\n';
    if (!inDollarQuote && current.trim().endsWith(';')) {
      const stmt = current.trim().replace(/;$/, '').trim();
      if (stmt.length > 0) statements.push(stmt);
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'seed-clean.sql'), 'utf8');
  const statements = splitSQL(sql);
  const client = await pool.connect();
  console.log('✅ Connected to Supabase\n');

  let success = 0, failed = 0;

  for (const stmt of statements) {
    const label = stmt.split('\n').find(l => l.trim()) || '';
    try {
      const result = await client.query(stmt);
      if (result.rows && result.rows.length > 0) {
        console.log(`📊 ${result.rows.map(r => Object.values(r).join(': ')).join(' | ')}`);
      } else {
        const count = result.rowCount !== null ? ` (${result.rowCount} rows affected)` : '';
        console.log(`✅ ${label.substring(0, 70)}${count}`);
      }
      success++;
    } catch (err) {
      console.error(`❌ ${label.substring(0, 60)}`);
      console.error(`   ${err.message.split('\n')[0]}`);
      failed++;
    }
  }

  client.release();
  await pool.end();
  console.log(`\n========================================`);
  console.log(`✅ Success: ${success}  ❌ Failed: ${failed}`);
  console.log(`========================================`);
}

run().catch(console.error);
