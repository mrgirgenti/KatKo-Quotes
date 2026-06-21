import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT pv.*, v.name AS "vendorName", v.website AS "vendorWebsite"
       FROM "ProductVendor" pv
       JOIN "Vendor" v ON v.id = pv."vendorId"
       WHERE pv."productId" = $1
       ORDER BY pv."isPreferred" DESC, pv."isActive" DESC, v.name ASC`,
      [id],
    );
    return Response.json({ sources: result.rows });
  } catch (err) {
    console.error('[GET /api/products/:id/vendor-sources]', err);
    return Response.json({ error: 'Failed to load vendor sources' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { vendorId, vendorSku, vendorProductUrl, isPreferred, notes } = body;
  if (!vendorId) return Response.json({ error: 'vendorId is required' }, { status: 400 });

  const client = await pool.connect();
  try {
    if (isPreferred) {
      await client.query(
        `UPDATE "ProductVendor" SET "isPreferred" = false, "updatedAt" = NOW() WHERE "productId" = $1`,
        [id],
      );
    }
    const result = await client.query(
      `INSERT INTO "ProductVendor" ("productId","vendorId","vendorSku","vendorProductUrl","isPreferred",notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, vendorId, vendorSku || null, vendorProductUrl || null, isPreferred ?? false, notes || null],
    );
    return Response.json({ source: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: 'This vendor is already a source for this product' }, { status: 409 });
    }
    console.error('[POST /api/products/:id/vendor-sources]', err);
    return Response.json({ error: 'Failed to add vendor source' }, { status: 500 });
  } finally {
    client.release();
  }
}
