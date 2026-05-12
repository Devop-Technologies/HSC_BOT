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

// Split SQL respecting dollar-quoted blocks ($$...$$)
function splitSQL(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) {
      continue; // skip comments
    }

    if (line.includes('$$')) {
      inDollarQuote = !inDollarQuote;
    }

    current += line + '\n';

    if (!inDollarQuote && current.trim().endsWith(';')) {
      const stmt = current.trim().replace(/;$/, '').trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function runMigration() {
  const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');
  const statements = splitSQL(sql);

  const client = await pool.connect();
  console.log('✅ Connected to Supabase\n');

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const statement of statements) {
    const label = statement.split('\n').find(l => l.trim()) || '';
    try {
      await client.query(statement);
      console.log(`✅ ${label.substring(0, 80)}`);
      success++;
    } catch (err) {
      if (
        err.message.includes('already exists') ||
        err.message.includes('does not exist') ||
        err.message.includes('duplicate')
      ) {
        console.log(`⏭️  SKIP: ${label.substring(0, 60)} — ${err.message.split('\n')[0]}`);
        skipped++;
      } else {
        console.error(`❌ FAILED: ${label.substring(0, 60)}`);
        console.error(`   Error : ${err.message.split('\n')[0]}`);
        failed++;
      }
    }
  }

  client.release();
  await pool.end();

  console.log(`\n========================================`);
  console.log(`✅ Success : ${success}`);
  console.log(`⏭️  Skipped : ${skipped}`);
  console.log(`❌ Failed  : ${failed}`);
  console.log(`========================================`);
}

runMigration().catch(console.error);
