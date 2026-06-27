/**
 * Run with: bun scripts/backfill-configured-product.ts
 *
 * Adds `configuredProduct` to every LineItem in every Project.lineItemsData.
 * Safe to re-run: skips items that already have configuredProduct.
 */
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function buildConfiguredProduct(item: any): any {
  const variants: any[] = item.garmentVariants?.length
    ? item.garmentVariants
    : [{ product: item.product || '', color: item.productColor || '', sizes: item.sizes ?? {} }];

  const primary = variants[0] ?? {};

  const colorVariants = variants.map((v: any) => ({
    color: v.color || '',
    colorHex: undefined,
    sizes: v.sizes ?? {},
  }));

  const printLocations: string[] = [
    item.location1,
    item.location2,
    item.location3,
    item.location4,
  ].filter((l: any): l is string => !!l);

  return {
    category: primary.category,
    productType: primary.category,
    styleNumber: primary.styleNumber,
    styleName: primary.productName,
    brand: primary.brand,
    productId: primary.productId,
    productSource: primary.productSource === 'catalog' ? 'catalog' : 'manual',
    productLabel: primary.product || item.product || undefined,
    productImageUrl: undefined,

    vendorName: item.apparelProvider || undefined,
    vendorSku: undefined,

    decorationMethod: item.serviceStyle || 'Screen Printing',

    colorVariants,

    printLocations,
    locationDetails: item.locationDetails || undefined,

    mockupUri: item.mockupUri,
    artworkLayers: [],
    templateSettings: {},

    productCostEach: item.productCostEach ?? 0,
    serviceCostEach: item.serviceCostEach ?? 0,
    serviceFeeEach: item.serviceFeeEach ?? 0,
    markupEach: item.markupEach ?? 0,
  };
}

async function run() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: string; lineItemsData: any }>(
      `SELECT id, "lineItemsData" FROM "Project"
       WHERE "lineItemsData" IS NOT NULL`,
    );

    console.log(`Found ${rows.length} projects with lineItemsData`);

    let projectsUpdated = 0;
    let itemsBackfilled = 0;
    let itemsSkipped = 0;

    for (const row of rows) {
      let lineItems: any[];
      try {
        lineItems = Array.isArray(row.lineItemsData)
          ? row.lineItemsData
          : JSON.parse(row.lineItemsData);
        if (!lineItems?.length) continue;
      } catch {
        continue;
      }

      let changed = false;
      const updated = lineItems.map((item: any) => {
        if (item.configuredProduct) {
          itemsSkipped++;
          return item;
        }
        const cp = buildConfiguredProduct(item);
        itemsBackfilled++;
        changed = true;
        return { ...item, configuredProduct: cp };
      });

      if (changed) {
        await client.query(
          `UPDATE "Project" SET "lineItemsData" = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
          [JSON.stringify(updated), row.id],
        );
        projectsUpdated++;
      }
    }

    console.log(`\n✅ Migration complete`);
    console.log(`   Projects scanned:   ${rows.length}`);
    console.log(`   Projects updated:   ${projectsUpdated}`);
    console.log(`   Items backfilled:   ${itemsBackfilled}`);
    console.log(`   Items already done: ${itemsSkipped}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
