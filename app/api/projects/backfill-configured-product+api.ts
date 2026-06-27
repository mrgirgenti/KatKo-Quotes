/**
 * POST /api/projects/backfill-configured-product
 *
 * One-time migration that adds a `configuredProduct` object to every
 * LineItem in every Project's lineItemsData JSON column.
 *
 * - Safe to run multiple times (idempotent: skips items that already
 *   have configuredProduct populated).
 * - Preserves all existing fields (backward-compatible additive change).
 * - Returns a summary of projects/items processed.
 */
import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { buildConfiguredProduct } from '@/utils/configuredProduct';
import type { LineItem } from '@/types/quote';

export async function POST(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: string; lineItemsData: unknown }>(
      `SELECT id, "lineItemsData" FROM "Project"
       WHERE "lineItemsData" IS NOT NULL
         AND jsonb_array_length("lineItemsData"::jsonb) > 0`,
    );

    let projectsUpdated = 0;
    let itemsBackfilled = 0;
    let itemsSkipped = 0;

    for (const row of rows) {
      let lineItems: LineItem[];
      try {
        lineItems = Array.isArray(row.lineItemsData)
          ? (row.lineItemsData as LineItem[])
          : JSON.parse(row.lineItemsData as string);
      } catch {
        continue;
      }

      let changed = false;
      const updated = lineItems.map((item) => {
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

    return Response.json({
      ok: true,
      projectsScanned: rows.length,
      projectsUpdated,
      itemsBackfilled,
      itemsSkipped,
      message: `Migration complete. ${itemsBackfilled} line items backfilled across ${projectsUpdated} projects. ${itemsSkipped} already had configuredProduct.`,
    });
  } catch (err: any) {
    console.error('[backfill-configured-product]', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: string; lineItemsData: unknown }>(
      `SELECT id, "lineItemsData" FROM "Project"
       WHERE "lineItemsData" IS NOT NULL
         AND jsonb_array_length("lineItemsData"::jsonb) > 0`,
    );

    let totalItems = 0;
    let alreadyMigrated = 0;
    let needsMigration = 0;

    for (const row of rows) {
      let lineItems: LineItem[];
      try {
        lineItems = Array.isArray(row.lineItemsData)
          ? (row.lineItemsData as LineItem[])
          : JSON.parse(row.lineItemsData as string);
      } catch {
        continue;
      }
      for (const item of lineItems) {
        totalItems++;
        if (item.configuredProduct) alreadyMigrated++;
        else needsMigration++;
      }
    }

    return Response.json({
      projectsWithLineItems: rows.length,
      totalItems,
      alreadyMigrated,
      needsMigration,
    });
  } finally {
    client.release();
  }
}
