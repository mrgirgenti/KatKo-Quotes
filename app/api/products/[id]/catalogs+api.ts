import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

const CATALOG_SELECT = `
  SELECT v.id, v.name, v.website, v."catalogUrl",
         COALESCE(pv."isActive", false) AS "isAssigned"
  FROM "Vendor" v
  LEFT JOIN "ProductVendor" pv
    ON pv."vendorId" = v.id AND pv."productId" = $1
  WHERE v."isActive" = true
  ORDER BY v.name ASC
`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const { id: productId } = await (params ?? Promise.resolve({ id: '' }));
  if (!productId) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const result = await client.query(CATALOG_SELECT, [productId]);
    return Response.json({ catalogs: result.rows });
  } catch (err) {
    console.error('[GET /api/products/[id]/catalogs]', err);
    return Response.json({ error: 'Failed to load catalogs' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const { id: productId } = await (params ?? Promise.resolve({ id: '' }));
  if (!productId) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const vendorIds: string[] = Array.isArray(body.vendorIds)
    ? (body.vendorIds as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (vendorIds.length > 0) {
      for (const vendorId of vendorIds) {
        await client.query(
          `INSERT INTO "ProductVendor" (id, "productId", "vendorId", "isActive", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
           ON CONFLICT ("productId", "vendorId") DO UPDATE SET "isActive" = true, "updatedAt" = NOW()`,
          [productId, vendorId],
        );
      }
      await client.query(
        `UPDATE "ProductVendor" SET "isActive" = false, "updatedAt" = NOW()
         WHERE "productId" = $1 AND "vendorId" != ALL($2::text[])`,
        [productId, vendorIds],
      );
    } else {
      await client.query(
        `UPDATE "ProductVendor" SET "isActive" = false, "updatedAt" = NOW()
         WHERE "productId" = $1`,
        [productId],
      );
    }

    await client.query('COMMIT');
    const result = await client.query(CATALOG_SELECT, [productId]);
    return Response.json({ catalogs: result.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PUT /api/products/[id]/catalogs]', err);
    return Response.json({ error: 'Failed to update catalog assignments' }, { status: 500 });
  } finally {
    client.release();
  }
}
