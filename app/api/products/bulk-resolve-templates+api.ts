import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { resolveTemplateKey } from '@/lib/templateMapping';

export async function POST(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const client = await pool.connect();
  try {
    const skippedRes = await client.query(
      `SELECT COUNT(*) FROM "Product" WHERE "templateId" IS NOT NULL`,
    );
    const skipped = parseInt(skippedRes.rows[0].count, 10);

    const productsRes = await client.query(
      `SELECT id, subcategory, "productType" FROM "Product" WHERE "templateId" IS NULL`,
    );
    const products = productsRes.rows as Array<{
      id: string;
      subcategory: string | null;
      productType: string | null;
    }>;

    let resolved = 0;
    let unresolved = 0;

    for (const product of products) {
      const { templateKey } = resolveTemplateKey(product.subcategory, product.productType);
      if (templateKey) {
        const tmplRes = await client.query(
          `SELECT id FROM "PlacementTemplate" WHERE key = $1 AND "isActive" = true`,
          [templateKey],
        );
        if (tmplRes.rows.length > 0) {
          await client.query(
            `UPDATE "Product" SET "templateId" = $1, "updatedAt" = NOW() WHERE id = $2`,
            [tmplRes.rows[0].id, product.id],
          );
          resolved++;
          continue;
        }
      }
      unresolved++;
    }

    return Response.json({ resolved, unresolved, skipped });
  } catch (err) {
    console.error('[POST /api/products/bulk-resolve-templates]', err);
    return Response.json({ error: 'Failed to bulk resolve templates' }, { status: 500 });
  } finally {
    client.release();
  }
}
