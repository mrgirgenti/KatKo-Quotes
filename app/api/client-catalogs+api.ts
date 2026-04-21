import { pool } from '@/lib/pool';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, name, description, "vendorName", category, "catalogUrl", "websiteUrl",
             "coverImageUrl", "isActive", "sortOrder", "createdAt"
      FROM "ClientCatalog"
      WHERE "isActive" = true
      ORDER BY "sortOrder" ASC, "createdAt" ASC
    `);
    return Response.json(result.rows);
  } catch (err) {
    console.error('[GET /api/client-catalogs]', err);
    return Response.json({ error: 'Failed to load client catalogs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, vendorName, category, catalogUrl, websiteUrl, coverImageUrl, sortOrder } = body;

    if (!name?.trim() || !catalogUrl?.trim()) {
      return Response.json({ error: 'Name and catalog URL are required' }, { status: 400 });
    }

    const result = await pool.query(`
      INSERT INTO "ClientCatalog" (id, name, description, "vendorName", category, "catalogUrl", "websiteUrl", "coverImageUrl", "sortOrder", "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
      RETURNING *
    `, [
      name.trim(),
      description?.trim() || null,
      vendorName?.trim() || null,
      category || 'Apparel',
      catalogUrl.trim(),
      websiteUrl?.trim() || null,
      coverImageUrl?.trim() || null,
      sortOrder ?? 0,
    ]);

    return Response.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[POST /api/client-catalogs]', err);
    return Response.json({ error: 'Failed to create catalog' }, { status: 500 });
  }
}
