import { pool } from '@/lib/pool';

function sumSizes(sizes: Record<string, number>): number {
  return Object.values(sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

async function upsertProjectItems(projectId: string, lineItems: any[]): Promise<number> {
  await pool.query(`DELETE FROM "ProjectItem" WHERE "projectId" = $1`, [projectId]);
  let count = 0;
  for (const item of lineItems) {
    const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean);
    const qty = item.garmentVariants?.length
      ? item.garmentVariants.reduce((s: number, v: any) => s + sumSizes(v.sizes || {}), 0)
      : sumSizes(item.sizes || {});
    await pool.query(
      `INSERT INTO "ProjectItem" (
        id, "projectId", "itemName", "productCategory", "garmentType",
        vendor, "catalogStyle", color, "printMethod", quantity,
        "sizeBreakdown", "printLocations", "artworkNotes", "rawLineItemData",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10::jsonb, $11::jsonb, $12, $13::jsonb,
        NOW(), NOW()
      )`,
      [
        projectId,
        item.designName || 'Untitled',
        item.serviceStyle || null,
        null,
        item.apparelProvider || null,
        item.product || null,
        item.productColor || null,
        item.serviceStyle || null,
        Math.max(qty, 0),
        JSON.stringify(item.sizes || {}),
        JSON.stringify(locations),
        item.locationDetails || null,
        JSON.stringify(item),
      ],
    );
    count++;
  }
  return count;
}

export async function POST(_req: Request, { id }: { id: string }) {
  try {
    const result = await pool.query(
      `SELECT id, "lineItemsData" FROM "Project" WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    const lineItems: any[] = result.rows[0].lineItemsData || [];
    const count = await upsertProjectItems(id, lineItems);
    return Response.json({ ok: true, itemsBackfilled: count });
  } catch (err) {
    console.error('[POST /api/projects/:id/backfill]', err);
    return Response.json({ error: 'Backfill failed' }, { status: 500 });
  }
}

export { upsertProjectItems };
