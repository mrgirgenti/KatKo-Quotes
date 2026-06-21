import { pool } from '../lib/pool';

async function main() {
  const client = await pool.connect();
  try {
    console.log('[1/4] Creating Vendor table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Vendor" (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL UNIQUE,
        website     TEXT,
        "isActive"  BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_isactive ON "Vendor"("isActive")`);

    console.log('[2/4] Seeding vendors...');
    const VENDORS = [
      { name: 'S&S Activewear',  website: 'https://www.ssactivewear.com' },
      { name: 'SanMar',          website: 'https://www.sanmar.com'        },
      { name: 'AlphaBroder',     website: 'https://www.alphabroder.com'   },
      { name: "McCreary's",      website: null                            },
      { name: 'Hit Promotional', website: 'https://www.hitpromo.net'      },
      { name: 'Starline',        website: 'https://www.starline.com'      },
      { name: 'Other',           website: null                            },
    ];
    for (const v of VENDORS) {
      await client.query(
        `INSERT INTO "Vendor" (name, website) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [v.name, v.website],
      );
    }
    console.log(`   → ${VENDORS.length} vendors seeded`);

    console.log('[3/4] Creating ProductVendor table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ProductVendor" (
        id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "productId"        TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
        "vendorId"         TEXT NOT NULL REFERENCES "Vendor"(id) ON DELETE RESTRICT,
        "vendorSku"        TEXT,
        "vendorProductUrl" TEXT,
        "isPreferred"      BOOLEAN NOT NULL DEFAULT false,
        "isActive"         BOOLEAN NOT NULL DEFAULT true,
        notes              TEXT,
        "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("productId", "vendorId")
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pv_productid    ON "ProductVendor"("productId")`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pv_vendorid     ON "ProductVendor"("vendorId")`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pv_ispreferred  ON "ProductVendor"("productId", "isPreferred")`);

    console.log('[4/4] Seeding product vendor sources for hero products...');
    const vRow = await client.query(`SELECT id, name FROM "Vendor" WHERE name IN ('S&S Activewear','SanMar','AlphaBroder')`);
    const vMap: Record<string, string> = {};
    for (const r of vRow.rows) vMap[r.name] = r.id;

    const sssId    = vMap['S&S Activewear'];
    const sanmarId = vMap['SanMar'];
    const alphaId  = vMap['AlphaBroder'];

    const heroStyles = ['NL6210','3001','5000','NL3601','PC61LS','18500','PC90H','K500','ST640'];
    const alphaStyles = new Set(['3001','5000','18500']);

    const prodRes = await client.query(
      `SELECT id, "styleNumber" FROM "Product" WHERE "styleNumber" = ANY($1::text[])`,
      [heroStyles],
    );

    let sourced = 0;
    for (const p of prodRes.rows) {
      await client.query(
        `INSERT INTO "ProductVendor" ("productId","vendorId","vendorSku","isPreferred",notes)
         VALUES ($1,$2,$3,true,'Primary distributor') ON CONFLICT ("productId","vendorId") DO NOTHING`,
        [p.id, sssId, p.styleNumber],
      );
      await client.query(
        `INSERT INTO "ProductVendor" ("productId","vendorId","vendorSku","isPreferred")
         VALUES ($1,$2,$3,false) ON CONFLICT ("productId","vendorId") DO NOTHING`,
        [p.id, sanmarId, p.styleNumber],
      );
      if (alphaStyles.has(p.styleNumber)) {
        await client.query(
          `INSERT INTO "ProductVendor" ("productId","vendorId","vendorSku","isPreferred")
           VALUES ($1,$2,$3,false) ON CONFLICT ("productId","vendorId") DO NOTHING`,
          [p.id, alphaId, p.styleNumber],
        );
      }
      sourced++;
    }

    const totalSources = prodRes.rows.length * 2 + alphaStyles.size;
    console.log(`   → ${sourced} products sourced (${totalSources} total source records)`);
    console.log('\nMigration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
