import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get('active') !== 'false';

  const client = await pool.connect();
  try {
    const where = activeOnly
      ? `WHERE "productId" = $1 AND "isActive" = true`
      : `WHERE "productId" = $1`;
    const result = await client.query(
      `SELECT * FROM "ProductColor" ${where} ORDER BY "sortOrder" ASC, "colorName" ASC`,
      [id],
    );
    return Response.json({ colors: result.rows });
  } catch (err) {
    console.error('[GET /api/products/:id/colors]', err);
    return Response.json({ error: 'Failed to load colors' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { colorCode, colorName, hex, sortOrder, catalogColorCode, notes } = body as Record<string, string>;

  if (!colorCode?.trim()) return Response.json({ error: 'colorCode is required' }, { status: 400 });
  if (!colorName?.trim()) return Response.json({ error: 'colorName is required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const productCheck = await client.query(`SELECT id FROM "Product" WHERE id = $1`, [id]);
    if (productCheck.rows.length === 0) return Response.json({ error: 'Product not found' }, { status: 404 });

    const result = await client.query(
      `INSERT INTO "ProductColor" (id, "productId", "colorCode", "colorName", hex, "catalogColorCode", notes, "isActive", "sortOrder", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
       RETURNING *`,
      [id, colorCode.trim(), colorName.trim(), hex?.trim() || null, catalogColorCode?.trim() || null, notes?.trim() || null, sortOrder ?? 0],
    );
    return Response.json({ color: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: `Color code "${colorCode}" already exists on this product` }, { status: 409 });
    }
    console.error('[POST /api/products/:id/colors]', err);
    return Response.json({ error: 'Failed to create color' }, { status: 500 });
  } finally {
    client.release();
  }
}
