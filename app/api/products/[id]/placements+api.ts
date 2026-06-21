import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

const VALID_PLACEMENT_TYPES = ['LEFT_CHEST', 'FULL_FRONT', 'FULL_BACK', 'YOKE', 'SLEEVE_LEFT', 'SLEEVE_RIGHT'];
const VALID_SIDES = ['FRONT', 'BACK'];

export async function GET(
  request: Request,
  { id }: { id: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const side = url.searchParams.get('side')?.toUpperCase();
  const activeOnly = url.searchParams.get('active') !== 'false';

  const conditions = [`"productId" = $1::uuid`];
  const values: unknown[] = [id];
  let idx = 2;

  if (activeOnly) {
    conditions.push(`"isActive" = true`);
  }
  if (side && VALID_SIDES.includes(side)) {
    conditions.push(`side = $${idx++}::"GarmentSide"`);
    values.push(side);
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM "ProductPlacement" WHERE ${conditions.join(' AND ')} ORDER BY side ASC, "placementType" ASC`,
      values,
    );
    return Response.json({ placements: result.rows });
  } catch (err) {
    console.error('[GET /api/products/:id/placements]', err);
    return Response.json({ error: 'Failed to load placements' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(
  request: Request,
  { id }: { id: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { placementType, side, x, y, width, height } = body as Record<string, unknown>;

  if (!placementType || !VALID_PLACEMENT_TYPES.includes(String(placementType))) {
    return Response.json({ error: `placementType must be one of: ${VALID_PLACEMENT_TYPES.join(', ')}` }, { status: 400 });
  }
  if (!side || !VALID_SIDES.includes(String(side))) {
    return Response.json({ error: 'side must be FRONT or BACK' }, { status: 400 });
  }
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return Response.json({ error: 'x, y, width, height are all required' }, { status: 400 });
  }
  for (const [key, val] of [['x', x], ['y', y], ['width', width], ['height', height]] as [string, unknown][]) {
    const n = Number(val);
    if (isNaN(n) || n < 0 || n > 1) {
      return Response.json({ error: `${key} must be a number between 0.0 and 1.0` }, { status: 400 });
    }
  }

  const client = await pool.connect();
  try {
    const productCheck = await client.query(`SELECT id FROM "Product" WHERE id = $1::uuid`, [id]);
    if (productCheck.rows.length === 0) return Response.json({ error: 'Product not found' }, { status: 404 });

    const result = await client.query(
      `INSERT INTO "ProductPlacement" (id, "productId", "placementType", side, x, y, width, height, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1::uuid, $2::"PlacementType", $3::"GarmentSide", $4, $5, $6, $7, true, NOW(), NOW())
       RETURNING *`,
      [id, placementType, side, Number(x), Number(y), Number(width), Number(height)],
    );
    return Response.json({ placement: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: `Placement "${placementType}" (${side}) already exists for this product` }, { status: 409 });
    }
    console.error('[POST /api/products/:id/placements]', err);
    return Response.json({ error: 'Failed to create placement' }, { status: 500 });
  } finally {
    client.release();
  }
}
