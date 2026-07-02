import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Record<string, string | null> },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const id = (params ?? {}).id ?? null;
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM "ProductionPricingPreset" WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ preset: result.rows[0] });
  } catch (err) {
    console.error('[GET /api/production-presets/[id]]', err);
    return Response.json({ error: 'Failed to load preset' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Record<string, string | null> },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const id = (params ?? {}).id ?? null;
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  function set(col: string, val: unknown) {
    values.push(val);
    setClauses.push(`"${col}" = $${values.length}`);
  }

  if (typeof body.name        === 'string') set('name',        body.name.trim());
  if (typeof body.serviceType === 'string') set('serviceType', body.serviceType.trim());
  if ('suggestedSellPrice'   in body) set('suggestedSellPrice',  body.suggestedSellPrice  != null ? Number(body.suggestedSellPrice)  : null);
  if (typeof body.status      === 'string') set('status', body.status);
  if ('maxWidth'              in body) set('maxWidth',   body.maxWidth  != null ? Number(body.maxWidth)  : null);
  if ('maxHeight'             in body) set('maxHeight',  body.maxHeight != null ? Number(body.maxHeight) : null);
  if ('defaultLocation'       in body) set('defaultLocation',  body.defaultLocation  || null);
  if ('defaultLocations'      in body) set('defaultLocations', body.defaultLocations || null);
  if ('defaultColorCount'     in body) set('defaultColorCount', body.defaultColorCount != null ? parseInt(String(body.defaultColorCount), 10) : null);
  if ('suggestedStitchRange'  in body) set('suggestedStitchRange', body.suggestedStitchRange || null);
  if ('notes'                 in body) set('notes', body.notes || null);
  if (typeof body.sortOrder   === 'number') set('sortOrder', body.sortOrder);

  if (setClauses.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });

  values.push(id);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "ProductionPricingPreset"
       SET ${setClauses.join(', ')}, "updatedAt" = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ preset: result.rows[0] });
  } catch (err) {
    console.error('[PATCH /api/production-presets/[id]]', err);
    return Response.json({ error: 'Failed to update preset' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Record<string, string | null> },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const id = (params ?? {}).id ?? null;
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM "ProductionPricingPreset" WHERE id = $1 RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/production-presets/[id]]', err);
    return Response.json({ error: 'Failed to delete preset' }, { status: 500 });
  } finally {
    client.release();
  }
}
