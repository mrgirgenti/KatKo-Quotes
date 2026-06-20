/**
 * Seed script: NL6210 — Next Level CVC Crew Tee
 *
 * Run with:  bun run scripts/seed-products.ts
 *
 * Idempotent: skips rows that already exist.
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PRODUCT = {
  styleNumber: 'NL6210',
  vendor:      'SanMar',
  brand:       'Next Level',
  name:        'CVC Crew Tee',
  category:    'Apparel',
};

const COLORS = [
  { colorCode: 'BLK',  colorName: 'Black',          hex: '#000000', sortOrder: 0 },
  { colorCode: 'WHT',  colorName: 'White',           hex: '#FFFFFF', sortOrder: 1 },
  { colorCode: 'HGY',  colorName: 'Heather Grey',    hex: '#9CA3AF', sortOrder: 2 },
  { colorCode: 'MLGN', colorName: 'Military Green',  hex: '#4B5320', sortOrder: 3 },
];

const PLACEMENTS = [
  { placementType: 'LEFT_CHEST',   side: 'FRONT', x: 0.14, y: 0.17, width: 0.26, height: 0.22 },
  { placementType: 'FULL_FRONT',   side: 'FRONT', x: 0.11, y: 0.20, width: 0.78, height: 0.58 },
  { placementType: 'FULL_BACK',    side: 'BACK',  x: 0.11, y: 0.14, width: 0.78, height: 0.63 },
  { placementType: 'YOKE',         side: 'BACK',  x: 0.20, y: 0.07, width: 0.60, height: 0.20 },
  { placementType: 'SLEEVE_LEFT',  side: 'FRONT', x: 0.01, y: 0.29, width: 0.14, height: 0.32 },
  { placementType: 'SLEEVE_RIGHT', side: 'FRONT', x: 0.85, y: 0.29, width: 0.14, height: 0.32 },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Product ────────────────────────────────────────────────────────────
    const existing = await client.query(
      `SELECT id FROM "Product" WHERE "styleNumber" = $1`,
      [PRODUCT.styleNumber],
    );

    let productId: string;
    if (existing.rows.length > 0) {
      productId = existing.rows[0].id;
      console.log(`  Product ${PRODUCT.styleNumber} already exists — skipping insert (id: ${productId})`);
    } else {
      const res = await client.query(
        `INSERT INTO "Product" (id, "styleNumber", vendor, brand, name, category, "isActive", "sortOrder", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, 0, NOW(), NOW())
         RETURNING id`,
        [PRODUCT.styleNumber, PRODUCT.vendor, PRODUCT.brand, PRODUCT.name, PRODUCT.category],
      );
      productId = res.rows[0].id;
      console.log(`✓ Inserted Product ${PRODUCT.styleNumber} (id: ${productId})`);
    }

    // ── 2. Colors ─────────────────────────────────────────────────────────────
    for (const color of COLORS) {
      const exists = await client.query(
        `SELECT id FROM "ProductColor" WHERE "productId" = $1 AND "colorCode" = $2`,
        [productId, color.colorCode],
      );
      if (exists.rows.length > 0) {
        console.log(`  Color ${color.colorCode} already exists — skipping`);
        continue;
      }
      await client.query(
        `INSERT INTO "ProductColor" (id, "productId", "colorCode", "colorName", hex, "isActive", "sortOrder", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, NOW(), NOW())`,
        [productId, color.colorCode, color.colorName, color.hex, color.sortOrder],
      );
      console.log(`✓ Inserted Color ${color.colorCode} — ${color.colorName}`);
    }

    // ── 3. Placements ─────────────────────────────────────────────────────────
    for (const p of PLACEMENTS) {
      const exists = await client.query(
        `SELECT id FROM "ProductPlacement" WHERE "productId" = $1 AND "placementType" = $2::"PlacementType" AND side = $3::"GarmentSide"`,
        [productId, p.placementType, p.side],
      );
      if (exists.rows.length > 0) {
        console.log(`  Placement ${p.placementType} (${p.side}) already exists — skipping`);
        continue;
      }
      await client.query(
        `INSERT INTO "ProductPlacement" (id, "productId", "placementType", side, x, y, width, height, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2::"PlacementType", $3::"GarmentSide", $4, $5, $6, $7, true, NOW(), NOW())`,
        [productId, p.placementType, p.side, p.x, p.y, p.width, p.height],
      );
      console.log(`✓ Inserted Placement ${p.placementType} (${p.side})  x=${p.x} y=${p.y} w=${p.width} h=${p.height}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed — rolled back.', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
