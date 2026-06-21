import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

const VALID_PLACEMENT_TYPES = ['LEFT_CHEST', 'FULL_FRONT', 'FULL_BACK', 'YOKE', 'SLEEVE_LEFT', 'SLEEVE_RIGHT'];
const VALID_SIDES = ['FRONT', 'BACK', 'LEFT', 'RIGHT'];

export async function POST(request: Request, { key }: { key: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!key) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { placementType, side, label, x, y, width, height,
          defaultArtworkWidth, defaultArtworkHeight,
          maxArtworkWidth, maxArtworkHeight, sortOrder } = body;

  if (!placementType || !VALID_PLACEMENT_TYPES.includes(placementType as string))
    return Response.json({ error: `placementType must be one of: ${VALID_PLACEMENT_TYPES.join(', ')}` }, { status: 400 });
  if (!side || !VALID_SIDES.includes(side as string))
    return Response.json({ error: `side must be one of: ${VALID_SIDES.join(', ')}` }, { status: 400 });
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number')
    return Response.json({ error: 'x, y, width, height are required numbers' }, { status: 400 });

  const client = await pool.connect();
  try {
    const tRes = await client.query(`SELECT id FROM "PlacementTemplate" WHERE key = $1`, [key]);
    if (tRes.rows.length === 0) return Response.json({ error: 'Template not found' }, { status: 404 });
    const templateId = tRes.rows[0].id;

    const result = await client.query(
      `INSERT INTO "TemplatePlacement"
         (id, "templateId", "placementType", side, label, x, y, width, height,
          "defaultArtworkWidth", "defaultArtworkHeight", "maxArtworkWidth", "maxArtworkHeight",
          "isActive", "sortOrder")
       VALUES (gen_random_uuid()::text, $1, $2::"PlacementType", $3::"GarmentSide", $4,
               $5, $6, $7, $8, $9, $10, $11, $12, true, $13)
       RETURNING *`,
      [templateId, placementType, side, label ?? null,
       x, y, width, height,
       defaultArtworkWidth ?? null, defaultArtworkHeight ?? null,
       maxArtworkWidth ?? null, maxArtworkHeight ?? null,
       typeof sortOrder === 'number' ? sortOrder : 0],
    );
    return Response.json({ placement: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') return Response.json({ error: 'That placement type + side already exists on this template' }, { status: 409 });
    console.error('[POST /api/products/placement-templates/:key/placements]', err);
    return Response.json({ error: 'Failed to create placement' }, { status: 500 });
  } finally {
    client.release();
  }
}
