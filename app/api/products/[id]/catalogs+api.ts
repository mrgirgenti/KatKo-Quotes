import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

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
    const result = await client.query(
      `SELECT cc.id, cc.name, cc."websiteUrl",
              CASE WHEN pcc."productId" IS NOT NULL THEN true ELSE false END AS "isAssigned"
       FROM "ClientCatalog" cc
       LEFT JOIN "ProductClientCatalog" pcc
         ON pcc."clientCatalogId" = cc.id AND pcc."productId" = $1
       WHERE cc."isActive" = true
       ORDER BY cc.name ASC`,
      [productId],
    );
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

  const catalogIds: string[] = Array.isArray(body.catalogIds)
    ? (body.catalogIds as unknown[]).filter((v): v is string => typeof v === 'string')
    : Array.isArray(body.vendorIds)
    ? (body.vendorIds as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM "ProductClientCatalog" WHERE "productId" = $1`, [productId]);
    for (const catalogId of catalogIds) {
      await client.query(
        `INSERT INTO "ProductClientCatalog" ("productId", "clientCatalogId", "createdAt")
         VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
        [productId, catalogId],
      );
    }
    await client.query('COMMIT');
    return Response.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PUT /api/products/[id]/catalogs]', err);
    return Response.json({ error: 'Failed to save catalog assignments' }, { status: 500 });
  } finally {
    client.release();
  }
}
