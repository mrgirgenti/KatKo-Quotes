/**
 * Additive migration: Product Catalog schema
 * Run with: bun scripts/migrate-product-catalog.ts
 *
 * Uses raw DDL to avoid prisma db push touching unrelated drifted columns.
 * Safe to re-run — all statements use IF NOT EXISTS / DO NOTHING guards.
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const steps: Array<{ label: string; sql: string }> = [
  {
    label: 'enum ProductAssetType',
    sql: `DO $$ BEGIN
      CREATE TYPE "ProductAssetType" AS ENUM ('THUMBNAIL','FRONT','BACK','LEFT_SIDE','RIGHT_SIDE','DETAIL');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    label: 'enum PlacementType',
    sql: `DO $$ BEGIN
      CREATE TYPE "PlacementType" AS ENUM ('LEFT_CHEST','FULL_FRONT','FULL_BACK','YOKE','SLEEVE_LEFT','SLEEVE_RIGHT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    label: 'enum GarmentSide',
    sql: `DO $$ BEGIN
      CREATE TYPE "GarmentSide" AS ENUM ('FRONT','BACK','LEFT','RIGHT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    label: 'table Product',
    sql: `CREATE TABLE IF NOT EXISTS "Product" (
      id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "styleNumber" TEXT       NOT NULL UNIQUE,
      vendor       TEXT        NOT NULL,
      brand        TEXT        NOT NULL,
      name         TEXT        NOT NULL,
      category     TEXT        NOT NULL,
      "isActive"   BOOLEAN     NOT NULL DEFAULT true,
      "sortOrder"  INTEGER     NOT NULL DEFAULT 0,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  },
  {
    label: 'indexes on Product',
    sql: `
      CREATE INDEX IF NOT EXISTS "Product_styleNumber_idx" ON "Product"("styleNumber");
      CREATE INDEX IF NOT EXISTS "Product_brand_idx"       ON "Product"(brand);
      CREATE INDEX IF NOT EXISTS "Product_vendor_idx"      ON "Product"(vendor);
      CREATE INDEX IF NOT EXISTS "Product_category_idx"    ON "Product"(category);
      CREATE INDEX IF NOT EXISTS "Product_isActive_idx"    ON "Product"("isActive");
    `,
  },
  {
    label: 'table ProductColor',
    sql: `CREATE TABLE IF NOT EXISTS "ProductColor" (
      id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "productId"  TEXT        NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
      "colorCode"  TEXT        NOT NULL,
      "colorName"  TEXT        NOT NULL,
      hex          TEXT,
      "isActive"   BOOLEAN     NOT NULL DEFAULT true,
      "sortOrder"  INTEGER     NOT NULL DEFAULT 0,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE("productId", "colorCode")
    );`,
  },
  {
    label: 'indexes on ProductColor',
    sql: `
      CREATE INDEX IF NOT EXISTS "ProductColor_productId_idx"          ON "ProductColor"("productId");
      CREATE INDEX IF NOT EXISTS "ProductColor_productId_isActive_idx" ON "ProductColor"("productId","isActive");
    `,
  },
  {
    label: 'table ProductAsset',
    sql: `CREATE TABLE IF NOT EXISTS "ProductAsset" (
      id               TEXT                 PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "productColorId" TEXT                 NOT NULL REFERENCES "ProductColor"(id) ON DELETE CASCADE,
      "assetType"      "ProductAssetType"   NOT NULL,
      "storageKey"     TEXT                 NOT NULL,
      "sortOrder"      INTEGER              NOT NULL DEFAULT 0,
      "createdAt"      TIMESTAMPTZ          NOT NULL DEFAULT NOW()
    );`,
  },
  {
    label: 'indexes on ProductAsset',
    sql: `
      CREATE INDEX IF NOT EXISTS "ProductAsset_productColorId_idx"          ON "ProductAsset"("productColorId");
      CREATE INDEX IF NOT EXISTS "ProductAsset_productColorId_assetType_idx" ON "ProductAsset"("productColorId","assetType");
    `,
  },
  {
    label: 'table ProductPlacement',
    sql: `CREATE TABLE IF NOT EXISTS "ProductPlacement" (
      id              TEXT             PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "productId"     TEXT             NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
      "placementType" "PlacementType"  NOT NULL,
      side            "GarmentSide"    NOT NULL,
      x               DOUBLE PRECISION NOT NULL,
      y               DOUBLE PRECISION NOT NULL,
      width           DOUBLE PRECISION NOT NULL,
      height          DOUBLE PRECISION NOT NULL,
      "isActive"      BOOLEAN          NOT NULL DEFAULT true,
      "createdAt"     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
      UNIQUE("productId","placementType",side)
    );`,
  },
  {
    label: 'indexes on ProductPlacement',
    sql: `
      CREATE INDEX IF NOT EXISTS "ProductPlacement_productId_idx"         ON "ProductPlacement"("productId");
      CREATE INDEX IF NOT EXISTS "ProductPlacement_productId_side_idx"    ON "ProductPlacement"("productId",side);
      CREATE INDEX IF NOT EXISTS "ProductPlacement_productId_isActive_idx" ON "ProductPlacement"("productId","isActive");
    `,
  },
];

async function main() {
  const client = await pool.connect();
  try {
    for (const step of steps) {
      try {
        await client.query(step.sql);
        console.log(`✓ ${step.label}`);
      } catch (err: unknown) {
        console.error(`✗ ${step.label}:`, (err as Error).message);
        throw err;
      }
    }
    console.log('\n✅ Product catalog migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
