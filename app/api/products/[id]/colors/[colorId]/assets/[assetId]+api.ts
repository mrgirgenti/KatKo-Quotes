import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { deleteUpload } from '@/lib/files';

export async function PATCH(
  request: Request,
  { id, colorId, assetId }: { id: string; colorId: string; assetId: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id || !colorId || !assetId) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { sortOrder } = body;
  if (sortOrder === undefined) return Response.json({ error: 'sortOrder is required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "ProductAsset" a
       SET "sortOrder" = $1
       FROM "ProductColor" c
       WHERE a.id = $2
         AND a."productColorId" = c.id
         AND c.id = $3
         AND c."productId" = $4
       RETURNING a.*`,
      [sortOrder, assetId, colorId, id],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Asset not found' }, { status: 404 });
    return Response.json({ asset: result.rows[0] });
  } catch (err) {
    console.error('[PATCH /api/products/:id/colors/:colorId/assets/:assetId]', err);
    return Response.json({ error: 'Failed to update asset' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: Request,
  { id, colorId, assetId }: { id: string; colorId: string; assetId: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id || !colorId || !assetId) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const findRes = await client.query(
      `SELECT a."storageKey"
       FROM "ProductAsset" a
       JOIN "ProductColor" c ON c.id = a."productColorId"
       WHERE a.id = $1 AND c.id = $2 AND c."productId" = $3`,
      [assetId, colorId, id],
    );
    if (findRes.rows.length === 0) return Response.json({ error: 'Asset not found' }, { status: 404 });

    const { storageKey } = findRes.rows[0];
    await deleteUpload(storageKey).catch((err: unknown) =>
      console.error('[DELETE asset] storage cleanup failed for', storageKey, err),
    );

    await client.query(`DELETE FROM "ProductAsset" WHERE id = $1`, [assetId]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/products/:id/colors/:colorId/assets/:assetId]', err);
    return Response.json({ error: 'Failed to delete asset' }, { status: 500 });
  } finally {
    client.release();
  }
}
