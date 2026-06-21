import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('[1/5] Extending ProductPlacement with dimension + label columns...');
    await client.query(`
      ALTER TABLE "ProductPlacement"
        ADD COLUMN IF NOT EXISTS "label"               TEXT,
        ADD COLUMN IF NOT EXISTS "defaultArtworkWidth"  DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "defaultArtworkHeight" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "maxArtworkWidth"      DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "maxArtworkHeight"     DOUBLE PRECISION;
    `);

    console.log('[2/5] Creating PlacementTemplate table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "PlacementTemplate" (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        key         TEXT UNIQUE NOT NULL,
        name        TEXT NOT NULL,
        description TEXT,
        "isActive"  BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('[3/5] Creating TemplatePlacement table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "TemplatePlacement" (
        id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "templateId"          TEXT NOT NULL REFERENCES "PlacementTemplate"(id) ON DELETE CASCADE,
        "placementType"       "PlacementType" NOT NULL,
        side                  "GarmentSide" NOT NULL,
        label                 TEXT,
        x                     DOUBLE PRECISION NOT NULL,
        y                     DOUBLE PRECISION NOT NULL,
        width                 DOUBLE PRECISION NOT NULL,
        height                DOUBLE PRECISION NOT NULL,
        "defaultArtworkWidth"  DOUBLE PRECISION,
        "defaultArtworkHeight" DOUBLE PRECISION,
        "maxArtworkWidth"      DOUBLE PRECISION,
        "maxArtworkHeight"     DOUBLE PRECISION,
        "isActive"            BOOLEAN NOT NULL DEFAULT true,
        "sortOrder"           INT NOT NULL DEFAULT 0,
        "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "TemplatePlacement_templateId_placementType_side_key"
          UNIQUE ("templateId", "placementType", side)
      );
      CREATE INDEX IF NOT EXISTS "TemplatePlacement_templateId_idx"
        ON "TemplatePlacement"("templateId");
    `);

    console.log('[4/5] Adding templateId FK to Product...');
    await client.query(`
      ALTER TABLE "Product"
        ADD COLUMN IF NOT EXISTS "templateId" TEXT
          REFERENCES "PlacementTemplate"(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "Product_templateId_idx" ON "Product"("templateId");
    `);

    console.log('[5/5] Seeding placement templates...');

    const templates = [
      { key: 'STANDARD_TSHIRT', name: 'Standard T-Shirt',   description: 'Standard crew neck tee (NL6210, B+C 3001, G5000, etc.)' },
      { key: 'LONG_SLEEVE',     name: 'Long Sleeve',         description: 'Long-sleeve tee (NL3601, B+C 3501, etc.)' },
      { key: 'HOODIE',          name: 'Hoodie / Sweatshirt', description: 'Pullover and zip hoodies (G18500, B+C 3719, etc.)' },
      { key: 'POLO',            name: 'Polo',                description: 'Short-sleeve polo shirts' },
      { key: 'TANK',            name: 'Tank Top',            description: 'Sleeveless tank tops' },
    ];

    type PlacementRow = {
      placementType: string;
      side: string;
      label: string;
      x: number; y: number; w: number; h: number;
      defW: number; defH: number;
      maxW: number; maxH: number;
      sortOrder: number;
    };

    const placements: Record<string, PlacementRow[]> = {
      STANDARD_TSHIRT: [
        { placementType: 'LEFT_CHEST',   side: 'FRONT', label: 'Left Chest',   x: 0.24, y: 0.18, w: 0.22, h: 0.20, defW: 3.5, defH: 3.5, maxW: 4.5, maxH: 4.5, sortOrder: 0 },
        { placementType: 'FULL_FRONT',   side: 'FRONT', label: 'Full Front',   x: 0.17, y: 0.28, w: 0.66, h: 0.50, defW: 10,  defH: 12,  maxW: 14,  maxH: 18,  sortOrder: 1 },
        { placementType: 'FULL_BACK',    side: 'BACK',  label: 'Full Back',    x: 0.17, y: 0.23, w: 0.66, h: 0.55, defW: 10,  defH: 12,  maxW: 14,  maxH: 18,  sortOrder: 2 },
        { placementType: 'YOKE',         side: 'BACK',  label: 'Yoke',         x: 0.17, y: 0.10, w: 0.66, h: 0.20, defW: 10,  defH: 4,   maxW: 12,  maxH: 6,   sortOrder: 3 },
        { placementType: 'SLEEVE_LEFT',  side: 'LEFT',  label: 'Left Sleeve',  x: 0.10, y: 0.20, w: 0.80, h: 0.60, defW: 2,   defH: 4,   maxW: 3,   maxH: 5,   sortOrder: 4 },
        { placementType: 'SLEEVE_RIGHT', side: 'RIGHT', label: 'Right Sleeve', x: 0.10, y: 0.20, w: 0.80, h: 0.60, defW: 2,   defH: 4,   maxW: 3,   maxH: 5,   sortOrder: 5 },
      ],
      LONG_SLEEVE: [
        { placementType: 'LEFT_CHEST',   side: 'FRONT', label: 'Left Chest',   x: 0.24, y: 0.18, w: 0.22, h: 0.20, defW: 3.5, defH: 3.5, maxW: 4.5, maxH: 4.5, sortOrder: 0 },
        { placementType: 'FULL_FRONT',   side: 'FRONT', label: 'Full Front',   x: 0.17, y: 0.28, w: 0.66, h: 0.50, defW: 10,  defH: 12,  maxW: 14,  maxH: 18,  sortOrder: 1 },
        { placementType: 'FULL_BACK',    side: 'BACK',  label: 'Full Back',    x: 0.17, y: 0.23, w: 0.66, h: 0.55, defW: 10,  defH: 12,  maxW: 14,  maxH: 18,  sortOrder: 2 },
        { placementType: 'YOKE',         side: 'BACK',  label: 'Yoke',         x: 0.17, y: 0.10, w: 0.66, h: 0.20, defW: 10,  defH: 4,   maxW: 12,  maxH: 6,   sortOrder: 3 },
        { placementType: 'SLEEVE_LEFT',  side: 'LEFT',  label: 'Left Sleeve',  x: 0.10, y: 0.20, w: 0.80, h: 0.65, defW: 3,   defH: 5,   maxW: 4,   maxH: 7,   sortOrder: 4 },
        { placementType: 'SLEEVE_RIGHT', side: 'RIGHT', label: 'Right Sleeve', x: 0.10, y: 0.20, w: 0.80, h: 0.65, defW: 3,   defH: 5,   maxW: 4,   maxH: 7,   sortOrder: 5 },
      ],
      HOODIE: [
        { placementType: 'LEFT_CHEST',   side: 'FRONT', label: 'Left Chest',   x: 0.24, y: 0.18, w: 0.22, h: 0.20, defW: 3.5, defH: 3.5, maxW: 4.5, maxH: 4.5, sortOrder: 0 },
        { placementType: 'FULL_FRONT',   side: 'FRONT', label: 'Full Front',   x: 0.17, y: 0.28, w: 0.66, h: 0.40, defW: 9,   defH: 11,  maxW: 12,  maxH: 14,  sortOrder: 1 },
        { placementType: 'FULL_BACK',    side: 'BACK',  label: 'Full Back',    x: 0.17, y: 0.20, w: 0.66, h: 0.55, defW: 10,  defH: 12,  maxW: 14,  maxH: 16,  sortOrder: 2 },
        { placementType: 'YOKE',         side: 'BACK',  label: 'Yoke',         x: 0.17, y: 0.10, w: 0.66, h: 0.20, defW: 10,  defH: 4,   maxW: 12,  maxH: 6,   sortOrder: 3 },
        { placementType: 'SLEEVE_LEFT',  side: 'LEFT',  label: 'Left Sleeve',  x: 0.10, y: 0.20, w: 0.80, h: 0.60, defW: 2.5, defH: 4,   maxW: 3.5, maxH: 5,   sortOrder: 4 },
        { placementType: 'SLEEVE_RIGHT', side: 'RIGHT', label: 'Right Sleeve', x: 0.10, y: 0.20, w: 0.80, h: 0.60, defW: 2.5, defH: 4,   maxW: 3.5, maxH: 5,   sortOrder: 5 },
      ],
      POLO: [
        { placementType: 'LEFT_CHEST',   side: 'FRONT', label: 'Left Chest',   x: 0.24, y: 0.22, w: 0.18, h: 0.16, defW: 3,   defH: 3,   maxW: 4,   maxH: 4,   sortOrder: 0 },
        { placementType: 'FULL_FRONT',   side: 'FRONT', label: 'Full Front',   x: 0.17, y: 0.32, w: 0.66, h: 0.44, defW: 8,   defH: 10,  maxW: 12,  maxH: 14,  sortOrder: 1 },
        { placementType: 'FULL_BACK',    side: 'BACK',  label: 'Full Back',    x: 0.17, y: 0.23, w: 0.66, h: 0.55, defW: 10,  defH: 12,  maxW: 14,  maxH: 16,  sortOrder: 2 },
        { placementType: 'YOKE',         side: 'BACK',  label: 'Yoke',         x: 0.17, y: 0.10, w: 0.66, h: 0.16, defW: 10,  defH: 3,   maxW: 12,  maxH: 5,   sortOrder: 3 },
        { placementType: 'SLEEVE_LEFT',  side: 'LEFT',  label: 'Left Sleeve',  x: 0.10, y: 0.20, w: 0.80, h: 0.50, defW: 1.5, defH: 3,   maxW: 2,   maxH: 4,   sortOrder: 4 },
        { placementType: 'SLEEVE_RIGHT', side: 'RIGHT', label: 'Right Sleeve', x: 0.10, y: 0.20, w: 0.80, h: 0.50, defW: 1.5, defH: 3,   maxW: 2,   maxH: 4,   sortOrder: 5 },
      ],
      TANK: [
        { placementType: 'LEFT_CHEST',   side: 'FRONT', label: 'Left Chest',   x: 0.24, y: 0.18, w: 0.22, h: 0.18, defW: 3,   defH: 3,   maxW: 4,   maxH: 4,   sortOrder: 0 },
        { placementType: 'FULL_FRONT',   side: 'FRONT', label: 'Full Front',   x: 0.17, y: 0.26, w: 0.66, h: 0.54, defW: 9,   defH: 11,  maxW: 12,  maxH: 16,  sortOrder: 1 },
        { placementType: 'FULL_BACK',    side: 'BACK',  label: 'Full Back',    x: 0.17, y: 0.20, w: 0.66, h: 0.58, defW: 9,   defH: 11,  maxW: 12,  maxH: 16,  sortOrder: 2 },
        { placementType: 'YOKE',         side: 'BACK',  label: 'Yoke',         x: 0.17, y: 0.08, w: 0.66, h: 0.18, defW: 9,   defH: 3,   maxW: 12,  maxH: 5,   sortOrder: 3 },
        { placementType: 'SLEEVE_LEFT',  side: 'LEFT',  label: 'Left Shoulder',x: 0.10, y: 0.20, w: 0.80, h: 0.55, defW: 1.5, defH: 3,   maxW: 2,   maxH: 4,   sortOrder: 4 },
        { placementType: 'SLEEVE_RIGHT', side: 'RIGHT', label: 'Right Shoulder',x: 0.10, y: 0.20, w: 0.80, h: 0.55, defW: 1.5, defH: 3,   maxW: 2,   maxH: 4,   sortOrder: 5 },
      ],
    };

    for (const t of templates) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO "PlacementTemplate" (id, key, name, description)
         VALUES (gen_random_uuid()::text, $1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, "updatedAt" = NOW()
         RETURNING id`,
        [t.key, t.name, t.description],
      );
      const templateId = res.rows[0].id;
      const rows = placements[t.key] ?? [];
      for (const p of rows) {
        await client.query(
          `INSERT INTO "TemplatePlacement"
             (id, "templateId", "placementType", side, label, x, y, width, height,
              "defaultArtworkWidth", "defaultArtworkHeight", "maxArtworkWidth", "maxArtworkHeight",
              "isActive", "sortOrder")
           VALUES (gen_random_uuid()::text, $1, $2::"PlacementType", $3::"GarmentSide", $4,
                   $5, $6, $7, $8, $9, $10, $11, $12, true, $13)
           ON CONFLICT ("templateId", "placementType", side)
           DO UPDATE SET
             label = EXCLUDED.label, x = EXCLUDED.x, y = EXCLUDED.y,
             width = EXCLUDED.width, height = EXCLUDED.height,
             "defaultArtworkWidth" = EXCLUDED."defaultArtworkWidth",
             "defaultArtworkHeight" = EXCLUDED."defaultArtworkHeight",
             "maxArtworkWidth" = EXCLUDED."maxArtworkWidth",
             "maxArtworkHeight" = EXCLUDED."maxArtworkHeight",
             "sortOrder" = EXCLUDED."sortOrder",
             "updatedAt" = NOW()`,
          [templateId, p.placementType, p.side, p.label,
           p.x, p.y, p.w, p.h, p.defW, p.defH, p.maxW, p.maxH, p.sortOrder],
        );
      }
      console.log(`  ✓ ${t.key} (${rows.length} placements)`);
    }

    await client.query('COMMIT');
    console.log('\nMigration complete.');
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
