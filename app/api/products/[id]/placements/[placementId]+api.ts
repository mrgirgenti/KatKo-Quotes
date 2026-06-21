import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

const VALID_PLACEMENT_TYPES = ['LEFT_CHEST', 'FULL_FRONT', 'FULL_BACK', 'YOKE', 'SLEEVE_LEFT', 'SLEEVE_RIGHT'];
const VALID_SIDES = ['FRONT', 'BACK'];

export async function PATCH(
  request: Request,
  { id, placementId }: { id: string; placementId: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id || !placementId) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { placementType, side, x, y, width, height, isActive } = body;

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (placementType !== undefined) {
    if (!VALID_PLACEMENT_TYPES.includes(String(placementType))) {
      return Response.json({ error: `placementType must be one of: ${VALID_PLACEMENT_TYPES.join(', ')}` }, { status: 400 });
    }
    updates.push(`"placementType" = $${idx++}::"PlacementType"`);
    values.push(placementType);
  }
  if (side !== undefined) {
    if (!VALID_SIDES.includes(String(side))) {
      return Response.json({ error: 'side must be FRONT or BACK' }, { status: 400 });
    }
    updates.push(`side = $${idx++}::"GarmentSide"`);
    values.push(side);
  }
  for (const [key, val] of [['x', x], ['y', y], ['width', width], ['height', height]] as [string, unknown][]) {
    if (val !== undefined) {
      const n = Number(val);
      if (isNaN(n) || n < 0 || n > 1) {
        return Response.json({ error: `${key} must be between 0.0 and 1.0` }, { status: 400 });
      }
      updates.push(`${key} = $${idx++}`);
      values.push(n);
    }
  }
  if (isActive !== undefined) {
    updates.push(`"isActive" = $${idx++}`);
    values.push(isActive);
  }

  if (updates.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });

  updates.push(`"updatedAt" = NOW()`);
  values.push(placementId, id);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "ProductPlacement" SET ${updates.join(', ')} WHERE id = $${idx}::uuid AND "productId" = $${idx + 1}::uuid RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return Response.json({ error: 'Placement not found' }, { status: 404 });
    return Response.json({ placement: result.rows[0] });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: 'That placement type + side combination already exists for this product' }, { status: 409 });
    }
    console.error('[PATCH /api/products/:id/placements/:placementId]', err);
    return Response.json({ error: 'Failed to update placement' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: Request,
  { id, placementId }: { id: string; placementId: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id || !placementId) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM "ProductPlacement" WHERE id = $1::uuid AND "productId" = $2::uuid RETURNING id`,
      [placementId, id],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Placement not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/products/:id/placements/:placementId]', err);
    return Response.json({ error: 'Failed to delete placement' }, { status: 500 });
  } finally {
    client.release();
  }
}
