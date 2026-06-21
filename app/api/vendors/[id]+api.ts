import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function PATCH(request: Request, params: { id?: string } = {}) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const { id } = params ?? {};
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return Response.json({ error: 'name cannot be empty' }, { status: 400 });
    updates.push(`name = $${idx++}`);
    values.push(name);
  }
  if (body.website !== undefined) {
    const website = typeof body.website === 'string' && body.website.trim() ? body.website.trim() : null;
    updates.push(`website = $${idx++}`);
    values.push(website);
  }
  if (body.catalogUrl !== undefined) {
    const catalogUrl = typeof body.catalogUrl === 'string' && body.catalogUrl.trim() ? body.catalogUrl.trim() : null;
    updates.push(`"catalogUrl" = $${idx++}`);
    values.push(catalogUrl);
  }
  if (body.isActive !== undefined) {
    updates.push(`"isActive" = $${idx++}`);
    values.push(Boolean(body.isActive));
  }

  if (updates.length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  updates.push(`"updatedAt" = NOW()`);
  values.push(id);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "Vendor" SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) {
      return Response.json({ error: 'Vendor not found' }, { status: 404 });
    }
    return Response.json({ vendor: result.rows[0] });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: 'A vendor with this name already exists' }, { status: 409 });
    }
    console.error('[PATCH /api/vendors/:id]', err);
    return Response.json({ error: 'Failed to update vendor' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, params: { id?: string } = {}) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const { id } = params ?? {};
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM "ProductVendor" WHERE "vendorId" = $1`,
      [id],
    );
    const sourceCount: number = countRes.rows[0]?.count ?? 0;
    if (sourceCount > 0) {
      return Response.json(
        {
          error: `This vendor is a source for ${sourceCount} product${sourceCount === 1 ? '' : 's'}. Deactivate it instead, or remove those sources first.`,
          sourceCount,
        },
        { status: 409 },
      );
    }

    const result = await client.query(`DELETE FROM "Vendor" WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return Response.json({ error: 'Vendor not found' }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23503') {
      return Response.json(
        { error: 'This vendor is still referenced by products. Deactivate it instead.' },
        { status: 409 },
      );
    }
    console.error('[DELETE /api/vendors/:id]', err);
    return Response.json({ error: 'Failed to delete vendor' }, { status: 500 });
  } finally {
    client.release();
  }
}
