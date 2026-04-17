import { Pool } from 'pg';

const globalForPool = globalThis as unknown as { pgPool: Pool };

export const pool =
  globalForPool.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (typeof globalForPool.pgPool === 'undefined') {
  globalForPool.pgPool = pool;
}
