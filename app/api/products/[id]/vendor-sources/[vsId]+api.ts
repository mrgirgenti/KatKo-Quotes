import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function PATCH(request: Request, { id, vsId }: { id: string; vsId: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id || !vsId) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const client = await pool.connect();
  try {
    if (body.isPreferred === true) {
      await client.query(
        `UPDATE "ProductVendor" SET "isPreferred" = false, "updatedAt" = NOW() WHERE "productId" = $1`,
        [id],
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if ('vendorSku'        in body) { updates.push(`"vendorSku" = $${idx++}`);         values.push(body.vendorSku ?? null); }
    if ('vendorProductUrl' in body) { updates.push(`"vendorProductUrl" = $${idx++}`);  values.push(body.vendorProductUrl ?? null); }
    if ('isPreferred'      in body) { updates.push(`"isPreferred" = $${idx++}`);        values.push(body.isPreferred); }
    if ('isActive'         in body) { updates.push(`"isActive" = $${idx++}`);           values.push(body.isActive); }
    if ('notes'            in body) { updates.push(`notes = $${idx++}`);                values.push(body.notes ?? null); }

    if (updates.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });

    updates.push(`"updatedAt" = NOW()`);
    values.push(vsId);
    values.push(id);

    const result = await client.query(
      `UPDATE "ProductVendor" SET ${updates.join(', ')}
       WHERE id = $${idx} AND "productId" = $${idx + 1} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return Response.json({ error: 'Source not found' }, { status: 404 });
    return Response.json({ source: result.rows[0] });
  } catch (err) {
    console.error('[PATCH /api/products/:id/vendor-sources/:vsId]', err);
    return Response.json({ error: 'Failed to update vendor source' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, { id, vsId }: { id: string; vsId: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id || !vsId) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM "ProductVendor" WHERE id = $1 AND "productId" = $2 RETURNING id`,
      [vsId, id],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Source not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/products/:id/vendor-sources/:vsId]', err);
    return Response.json({ error: 'Failed to delete vendor source' }, { status: 500 });
  } finally {
    client.release();
  }
}
