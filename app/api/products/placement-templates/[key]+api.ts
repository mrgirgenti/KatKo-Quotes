import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request, { key }: { key: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!key) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const tRes = await client.query(
      `SELECT * FROM "PlacementTemplate" WHERE key = $1`,
      [key],
    );
    if (tRes.rows.length === 0) return Response.json({ error: 'Template not found' }, { status: 404 });
    const template = tRes.rows[0] as Record<string, unknown>;

    const pRes = await client.query(
      `SELECT * FROM "TemplatePlacement" WHERE "templateId" = $1 ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      [template.id],
    );
    template.placements = pRes.rows;

    return Response.json({ template });
  } catch (err) {
    console.error('[GET /api/products/placement-templates/:key]', err);
    return Response.json({ error: 'Failed to load template' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request, { key }: { key: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!key) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { name, description, isActive } = body;
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (name !== undefined)        { updates.push(`name = $${idx++}`);        values.push(name); }
  if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
  if (isActive !== undefined)    { updates.push(`"isActive" = $${idx++}`);  values.push(isActive); }

  if (updates.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });
  updates.push(`"updatedAt" = NOW()`);
  values.push(key);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "PlacementTemplate" SET ${updates.join(', ')} WHERE key = $${idx} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return Response.json({ error: 'Template not found' }, { status: 404 });
    return Response.json({ template: result.rows[0] });
  } catch (err) {
    console.error('[PATCH /api/products/placement-templates/:key]', err);
    return Response.json({ error: 'Failed to update template' }, { status: 500 });
  } finally {
    client.release();
  }
}
