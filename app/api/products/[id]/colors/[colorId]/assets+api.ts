import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { writeProductAsset } from '@/lib/files';

const VALID_ASSET_TYPES = ['FRONT_FLAT', 'BACK_FLAT', 'FRONT_REALISTIC', 'BACK_REALISTIC', 'THUMBNAIL'];

const ALLOWED_MIME_TYPES: Record<string, boolean> = {
  'image/png': true,
  'image/jpeg': true,
  'image/webp': true,
};

export async function GET(
  _request: Request,
  { id, colorId }: { id: string; colorId: string },
) {
  const authedUser = await authenticateRequest(_request);
  if (!authedUser) return unauthorized();
  if (!id || !colorId) return Response.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(_request.url);
  const assetType = url.searchParams.get('assetType');

  const client = await pool.connect();
  try {
    const colorCheck = await client.query(
      `SELECT id FROM "ProductColor" WHERE id = $1::uuid AND "productId" = $2::uuid`,
      [colorId, id],
    );
    if (colorCheck.rows.length === 0) return Response.json({ error: 'Color not found' }, { status: 404 });

    const conditions = [`"productColorId" = $1::uuid`];
    const values: unknown[] = [colorId];

    if (assetType && VALID_ASSET_TYPES.includes(assetType)) {
      conditions.push(`"assetType" = $2::"ProductAssetType"`);
      values.push(assetType);
    }

    const result = await client.query(
      `SELECT * FROM "ProductAsset" WHERE ${conditions.join(' AND ')} ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      values,
    );
    return Response.json({ assets: result.rows });
  } catch (err) {
    console.error('[GET /api/products/:id/colors/:colorId/assets]', err);
    return Response.json({ error: 'Failed to load assets' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(
  request: Request,
  { id, colorId }: { id: string; colorId: string },
) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id || !colorId) return Response.json({ error: 'Not found' }, { status: 404 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const fileEntry = formData.get('file') as File | null;
  const assetType = (formData.get('assetType') as string | null)?.toUpperCase();
  const sortOrderRaw = formData.get('sortOrder') as string | null;
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

  if (!fileEntry) return Response.json({ error: 'file is required' }, { status: 400 });
  if (!assetType || !VALID_ASSET_TYPES.includes(assetType)) {
    return Response.json({ error: `assetType must be one of: ${VALID_ASSET_TYPES.join(', ')}` }, { status: 400 });
  }

  const mimeType = fileEntry.type || 'application/octet-stream';
  if (!ALLOWED_MIME_TYPES[mimeType]) {
    return Response.json({ error: 'Only PNG, JPEG, and WebP images are supported for product assets.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const colorCheck = await client.query(
      `SELECT id FROM "ProductColor" WHERE id = $1::uuid AND "productId" = $2::uuid`,
      [colorId, id],
    );
    if (colorCheck.rows.length === 0) return Response.json({ error: 'Color not found' }, { status: 404 });

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const storageKey = await writeProductAsset(fileEntry.name, buffer);

    const result = await client.query(
      `INSERT INTO "ProductAsset" (id, "productColorId", "assetType", "storageKey", "sortOrder", "createdAt")
       VALUES (gen_random_uuid(), $1::uuid, $2::"ProductAssetType", $3, $4, NOW())
       RETURNING *`,
      [colorId, assetType, storageKey, sortOrder],
    );
    return Response.json({ asset: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/products/:id/colors/:colorId/assets]', err);
    return Response.json({ error: 'Failed to upload asset' }, { status: 500 });
  } finally {
    client.release();
  }
}
