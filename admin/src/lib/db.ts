import { Pool } from 'pg';

declare global {
  var hscAdminPgPool: Pool | undefined;
}

export const pool = global.hscAdminPgPool || new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

if (process.env.NODE_ENV !== 'production') {
  global.hscAdminPgPool = pool;
}
