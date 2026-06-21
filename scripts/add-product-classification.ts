import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('[1/2] Adding classification columns to Product...');
    await client.query(`
      ALTER TABLE "Product"
        ADD COLUMN IF NOT EXISTS subcategory   TEXT,
        ADD COLUMN IF NOT EXISTS "productType" TEXT,
        ADD COLUMN IF NOT EXISTS gender        TEXT;
    `);

    console.log('[2/2] Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS "Product_subcategory_idx"   ON "Product"(subcategory);
      CREATE INDEX IF NOT EXISTS "Product_productType_idx"   ON "Product"("productType");
      CREATE INDEX IF NOT EXISTS "Product_gender_idx"        ON "Product"(gender);
    `);

    await client.query('COMMIT');
    console.log('\nMigration complete. Products can now have subcategory, productType, and gender.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
