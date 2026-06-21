import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { key, placementId }: { key: string; placementId: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!key || !placementId) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { label, x, y, width, height,
          defaultArtworkWidth, defaultArtworkHeight,
          maxArtworkWidth, maxArtworkHeight,
          isActive, sortOrder } = body;

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (label !== undefined)               { updates.push(`label = $${idx++}`);                   values.push(label); }
  if (x !== undefined)                   { updates.push(`x = $${idx++}`);                       values.push(x); }
  if (y !== undefined)                   { updates.push(`y = $${idx++}`);                       values.push(y); }
  if (width !== undefined)               { updates.push(`width = $${idx++}`);                   values.push(width); }
  if (height !== undefined)              { updates.push(`height = $${idx++}`);                  values.push(height); }
  if (defaultArtworkWidth !== undefined) { updates.push(`"defaultArtworkWidth" = $${idx++}`);  values.push(defaultArtworkWidth); }
  if (defaultArtworkHeight !== undefined){ updates.push(`"defaultArtworkHeight" = $${idx++}`); values.push(defaultArtworkHeight); }
  if (maxArtworkWidth !== undefined)     { updates.push(`"maxArtworkWidth" = $${idx++}`);       values.push(maxArtworkWidth); }
  if (maxArtworkHeight !== undefined)    { updates.push(`"maxArtworkHeight" = $${idx++}`);      values.push(maxArtworkHeight); }
  if (isActive !== undefined)            { updates.push(`"isActive" = $${idx++}`);              values.push(isActive); }
  if (sortOrder !== undefined)           { updates.push(`"sortOrder" = $${idx++}`);             values.push(sortOrder); }

  if (updates.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });
  updates.push(`"updatedAt" = NOW()`);

  values.push(placementId, key);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "TemplatePlacement" tp
       SET ${updates.join(', ')}
       FROM "PlacementTemplate" t
       WHERE tp.id = $${idx}
         AND tp."templateId" = t.id
         AND t.key = $${idx + 1}
       RETURNING tp.*`,
      values,
    );
    if (result.rows.length === 0) return Response.json({ error: 'Placement not found' }, { status: 404 });
    return Response.json({ placement: result.rows[0] });
  } catch (err) {
    console.error('[PATCH /api/products/placement-templates/:key/placements/:id]', err);
    return Response.json({ error: 'Failed to update placement' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: Request,
  { key, placementId }: { key: string; placementId: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!key || !placementId) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM "TemplatePlacement" tp
       USING "PlacementTemplate" t
       WHERE tp.id = $1 AND tp."templateId" = t.id AND t.key = $2
       RETURNING tp.id`,
      [placementId, key],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Placement not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/products/placement-templates/:key/placements/:id]', err);
    return Response.json({ error: 'Failed to delete placement' }, { status: 500 });
  } finally {
    client.release();
  }
}
