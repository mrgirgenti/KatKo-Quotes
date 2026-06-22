import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function POST(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, ids, value, vendorId } = body as {
    action: string;
    ids: string[];
    value?: string;
    vendorId?: string;
  };

  if (!action) return Response.json({ error: 'action is required' }, { status: 400 });
  if (!Array.isArray(ids) || ids.length === 0) return Response.json({ error: 'ids must be a non-empty array' }, { status: 400 });

  const client = await pool.connect();
  try {
    switch (action) {
      case 'activate':
        await client.query(
          `UPDATE "Product" SET "isActive" = true, "updatedAt" = NOW() WHERE id = ANY($1::text[])`,
          [ids],
        );
        return Response.json({ updated: ids.length });

      case 'deactivate':
        await client.query(
          `UPDATE "Product" SET "isActive" = false, "updatedAt" = NOW() WHERE id = ANY($1::text[])`,
          [ids],
        );
        return Response.json({ updated: ids.length });

      case 'delete':
        await client.query(`DELETE FROM "Product" WHERE id = ANY($1::text[])`, [ids]);
        return Response.json({ deleted: ids.length });

      case 'assign-category':
        if (!value?.trim()) return Response.json({ error: 'value is required' }, { status: 400 });
        await client.query(
          `UPDATE "Product" SET category = $1, "updatedAt" = NOW() WHERE id = ANY($2::text[])`,
          [value.trim(), ids],
        );
        return Response.json({ updated: ids.length });

      case 'assign-subcategory':
        await client.query(
          `UPDATE "Product" SET subcategory = $1, "updatedAt" = NOW() WHERE id = ANY($2::text[])`,
          [value?.trim() || null, ids],
        );
        return Response.json({ updated: ids.length });

      case 'assign-product-type':
        await client.query(
          `UPDATE "Product" SET "productType" = $1, "updatedAt" = NOW() WHERE id = ANY($2::text[])`,
          [value?.trim() || null, ids],
        );
        return Response.json({ updated: ids.length });

      case 'assign-template': {
        if (!value?.trim()) return Response.json({ error: 'templateId is required' }, { status: 400 });
        const tmpl = await client.query(`SELECT id FROM "PlacementTemplate" WHERE id = $1`, [value.trim()]);
        if (tmpl.rows.length === 0) return Response.json({ error: 'Template not found' }, { status: 404 });
        await client.query(
          `UPDATE "Product" SET "templateId" = $1, "updatedAt" = NOW() WHERE id = ANY($2::text[])`,
          [value.trim(), ids],
        );
        return Response.json({ updated: ids.length });
      }

      case 'set-cost': {
        const num = parseFloat(String(value));
        if (isNaN(num) || num < 0) return Response.json({ error: 'Invalid cost value' }, { status: 400 });
        await client.query(
          `UPDATE "Product" SET "defaultBlankCost" = $1, "lastCostUpdatedAt" = NOW(), "updatedAt" = NOW() WHERE id = ANY($2::text[])`,
          [num, ids],
        );
        return Response.json({ updated: ids.length });
      }

      case 'adjust-cost-pct': {
        const pct = parseFloat(String(value));
        if (isNaN(pct)) return Response.json({ error: 'Invalid percentage' }, { status: 400 });
        await client.query(
          `UPDATE "Product" SET
            "defaultBlankCost" = ROUND(CAST("defaultBlankCost" * $1 AS numeric), 4),
            "lastCostUpdatedAt" = NOW(),
            "updatedAt" = NOW()
          WHERE id = ANY($2::text[]) AND "defaultBlankCost" IS NOT NULL`,
          [1 + pct / 100, ids],
        );
        return Response.json({ updated: ids.length });
      }

      case 'clear-cost': {
        await client.query(
          `UPDATE "Product" SET "defaultBlankCost" = NULL, "lastCostUpdatedAt" = NULL, "updatedAt" = NOW() WHERE id = ANY($1::text[])`,
          [ids],
        );
        return Response.json({ updated: ids.length });
      }

      case 'assign-source': {
        if (!vendorId?.trim()) return Response.json({ error: 'vendorId is required' }, { status: 400 });
        const vendor = await client.query(`SELECT "isActive" FROM "Vendor" WHERE id = $1`, [vendorId]);
        if (vendor.rows.length === 0) return Response.json({ error: 'Vendor not found' }, { status: 404 });
        if (vendor.rows[0].isActive === false) {
          return Response.json({ error: 'This vendor is inactive and cannot be assigned as a source.' }, { status: 409 });
        }
        let added = 0;
        for (const productId of ids) {
          const existing = await client.query(
            `SELECT id FROM "ProductVendor" WHERE "productId" = $1 AND "vendorId" = $2`,
            [productId, vendorId],
          );
          if (existing.rows.length === 0) {
            await client.query(
              `INSERT INTO "ProductVendor" (id, "productId", "vendorId", "isPreferred", "isActive", "createdAt", "updatedAt")
               VALUES (gen_random_uuid(), $1, $2, false, true, NOW(), NOW())`,
              [productId, vendorId],
            );
            added++;
          }
        }
        return Response.json({ added, skipped: ids.length - added });
      }

      case 'remove-source': {
        if (!vendorId?.trim()) return Response.json({ error: 'vendorId is required' }, { status: 400 });
        const result = await client.query(
          `DELETE FROM "ProductVendor" WHERE "productId" = ANY($1::text[]) AND "vendorId" = $2`,
          [ids, vendorId],
        );
        return Response.json({ removed: result.rowCount });
      }

      case 'set-preferred-source': {
        if (!vendorId?.trim()) return Response.json({ error: 'vendorId is required' }, { status: 400 });
        const prefVendor = await client.query(`SELECT "isActive" FROM "Vendor" WHERE id = $1`, [vendorId]);
        if (prefVendor.rows.length === 0) return Response.json({ error: 'Vendor not found' }, { status: 404 });
        if (prefVendor.rows[0].isActive === false) {
          return Response.json({ error: 'This vendor is inactive and cannot be set as the preferred source.' }, { status: 409 });
        }
        for (const productId of ids) {
          await client.query(
            `UPDATE "ProductVendor" SET "isPreferred" = false WHERE "productId" = $1`,
            [productId],
          );
          await client.query(
            `UPDATE "ProductVendor" SET "isPreferred" = true WHERE "productId" = $1 AND "vendorId" = $2`,
            [productId, vendorId],
          );
        }
        return Response.json({ updated: ids.length });
      }

      case 'assign-catalog': {
        const { catalogId } = body as { catalogId?: string };
        if (!catalogId?.trim()) return Response.json({ error: 'catalogId required' }, { status: 400 });
        for (const productId of ids) {
          await client.query(
            `INSERT INTO "ProductClientCatalog" ("productId", "clientCatalogId", "createdAt")
             VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
            [productId, catalogId],
          );
        }
        return Response.json({ updated: ids.length });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error(`[POST /api/products/bulk] action=${action}`, err);
    return Response.json({ error: 'Bulk operation failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
