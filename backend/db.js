const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('✅ Supabase PostgreSQL connected, database : ', client.connectionParameters.database);
    client.release();
  } catch (err) {
    console.error('❌ Supabase connection failed:', err.message);
  }
}

pool.on('error', (err) => {
  console.error('Database error:', err.message);
});

module.exports = { pool, connectDB };
