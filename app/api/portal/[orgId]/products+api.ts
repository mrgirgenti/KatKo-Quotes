import { pool } from '@/lib/pool';

export async function GET(
  _request: Request,
  { orgId }: { orgId: string }
) {
  if (!orgId) return Response.json({ error: 'Not found' }, { status: 404 });

  try {
    const orgCheck = await pool.query(
      `SELECT id FROM "Organization" WHERE id = $1 AND "hubEnabled" = true`,
      [orgId]
    );
    if (!orgCheck.rows[0]) {
      return Response.json({ error: 'Hub not found or not enabled' }, { status: 403 });
    }

    const result = await pool.query(`
      SELECT
        p.id,
        p."styleNumber",
        p.vendor,
        p.brand,
        p.name,
        p.category,
        p.subcategory,
        COALESCE(
          json_agg(
            json_build_object(
              'id',        pc.id,
              'colorCode', pc."colorCode",
              'colorName', pc."colorName",
              'hex',       pc.hex
            ) ORDER BY pc."sortOrder" ASC, pc."colorName" ASC
          ) FILTER (WHERE pc.id IS NOT NULL AND pc."isActive" = true),
          '[]'::json
        ) AS colors
      FROM "Product" p
      LEFT JOIN "ProductColor" pc ON pc."productId" = p.id
      WHERE p."isActive" = true AND p."isLegacy" = false
      GROUP BY p.id
      ORDER BY p."sortOrder" ASC, p.brand ASC, p."styleNumber" ASC
    `);

    return Response.json({ products: result.rows });
  } catch (err) {
    console.error('[GET /api/portal/:orgId/products]', err);
    return Response.json({ error: 'Failed to load products' }, { status: 500 });
  }
}
