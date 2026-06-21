import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const productRes = await client.query(
      `SELECT id, "templateId" FROM "Product" WHERE id = $1`,
      [id],
    );
    if (productRes.rows.length === 0) return Response.json({ error: 'Product not found' }, { status: 404 });
    const { templateId } = productRes.rows[0];

    const overrideRes = await client.query(
      `SELECT pp.*, 'override' AS source, NULL AS "templateKey"
       FROM "ProductPlacement" pp
       WHERE pp."productId" = $1 AND pp."isActive" = true`,
      [id],
    );

    let templatePlacements: Array<Record<string, unknown>> = [];
    let templateKey: string | null = null;

    if (templateId) {
      const tkRes = await client.query(
        `SELECT key FROM "PlacementTemplate" WHERE id = $1`,
        [templateId],
      );
      if (tkRes.rows.length > 0) {
        templateKey = tkRes.rows[0].key;
        const tpRes = await client.query(
          `SELECT tp.*, 'template' AS source, $2 AS "templateKey"
           FROM "TemplatePlacement" tp
           WHERE tp."templateId" = $1 AND tp."isActive" = true
           ORDER BY tp."sortOrder" ASC`,
          [templateId, templateKey],
        );
        templatePlacements = tpRes.rows as Array<Record<string, unknown>>;
      }
    }

    const overrides = overrideRes.rows as Array<Record<string, unknown>>;
    const overrideKeys = new Set(
      overrides.map(o => `${o.placementType}:${o.side}`),
    );

    const merged = [
      ...overrides,
      ...templatePlacements.filter(tp => !overrideKeys.has(`${tp.placementType}:${tp.side}`)),
    ].sort((a, b) => {
      const ORDER = ['LEFT_CHEST', 'FULL_FRONT', 'FULL_BACK', 'YOKE', 'SLEEVE_LEFT', 'SLEEVE_RIGHT'];
      return ORDER.indexOf(a.placementType as string) - ORDER.indexOf(b.placementType as string);
    });

    return Response.json({ placements: merged, templateKey });
  } catch (err) {
    console.error('[GET /api/products/:id/effective-placements]', err);
    return Response.json({ error: 'Failed to load effective placements' }, { status: 500 });
  } finally {
    client.release();
  }
}
