import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { deleteUpload } from '@/lib/files';

export async function PATCH(
  request: Request,
  { id, colorId }: { id: string; colorId: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id || !colorId) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { colorCode, colorName, hex, isActive, sortOrder } = body;

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (colorCode !== undefined) { updates.push(`"colorCode" = $${idx++}`); values.push(colorCode); }
  if (colorName !== undefined) { updates.push(`"colorName" = $${idx++}`); values.push(colorName); }
  if (hex !== undefined)       { updates.push(`hex = $${idx++}`);         values.push(hex || null); }
  if (isActive !== undefined)  { updates.push(`"isActive" = $${idx++}`);  values.push(isActive); }
  if (sortOrder !== undefined) { updates.push(`"sortOrder" = $${idx++}`); values.push(sortOrder); }

  if (updates.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });

  updates.push(`"updatedAt" = NOW()`);
  values.push(colorId);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "ProductColor" SET ${updates.join(', ')} WHERE id = $${idx} AND "productId" = $${idx + 1} RETURNING *`,
      [...values, id],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Color not found' }, { status: 404 });
    return Response.json({ color: result.rows[0] });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: 'Color code already exists on this product' }, { status: 409 });
    }
    console.error('[PATCH /api/products/:id/colors/:colorId]', err);
    return Response.json({ error: 'Failed to update color' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  _request: Request,
  { id, colorId }: { id: string; colorId: string },
) {
  const authedUser = await authenticateRequest(_request);
  if (!authedUser) return unauthorized();
  if (!id || !colorId) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const assetRes = await client.query(
      `SELECT "storageKey" FROM "ProductAsset" WHERE "productColorId" = $1`,
      [colorId],
    );
    for (const row of assetRes.rows) {
      await deleteUpload(row.storageKey).catch((err: unknown) =>
        console.error('[DELETE color] storage cleanup failed for', row.storageKey, err),
      );
    }

    const result = await client.query(
      `DELETE FROM "ProductColor" WHERE id = $1 AND "productId" = $2 RETURNING id`,
      [colorId, id],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Color not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/products/:id/colors/:colorId]', err);
    return Response.json({ error: 'Failed to delete color' }, { status: 500 });
  } finally {
    client.release();
  }
}
