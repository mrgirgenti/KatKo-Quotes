import { pool } from '@/lib/pool';

export async function GET(req: Request) {
  try {
    let clientHubOnly = false;
    try {
      const u = new URL(req.url, 'http://localhost');
      clientHubOnly = u.searchParams.get('clientHub') === '1';
    } catch {}

    const where = clientHubOnly
      ? `WHERE "isActive" = true AND "showInClientHub" = true`
      : `WHERE "isActive" = true`;

    const result = await pool.query(`
      SELECT id, name, description, "vendorName", category, "catalogUrl", "websiteUrl",
             "coverImageUrl", "logoColor", "logoInitials", "isActive", "showInClientHub",
             "isFeatured", "sortOrder", "createdAt"
      FROM "ClientCatalog"
      ${where}
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
    const {
      name, description, vendorName, category,
      catalogUrl, websiteUrl, coverImageUrl,
      logoColor, logoInitials,
      showInClientHub, isFeatured, sortOrder,
    } = body;

    if (!name?.trim()) {
      return Response.json({ error: 'Vendor name is required' }, { status: 400 });
    }

    const result = await pool.query(`
      INSERT INTO "ClientCatalog" (
        id, name, description, "vendorName", category,
        "catalogUrl", "websiteUrl", "coverImageUrl",
        "logoColor", "logoInitials",
        "showInClientHub", "isFeatured", "sortOrder", "isActive", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), NOW())
      RETURNING *
    `, [
      name.trim(),
      description?.trim() || null,
      vendorName?.trim() || null,
      category || 'Apparel',
      catalogUrl?.trim() || null,
      websiteUrl?.trim() || null,
      coverImageUrl?.trim() || null,
      logoColor?.trim() || null,
      logoInitials?.trim() || null,
      showInClientHub ?? false,
      isFeatured ?? false,
      sortOrder ?? 0,
    ]);

    return Response.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[POST /api/client-catalogs]', err);
    return Response.json({ error: 'Failed to create vendor' }, { status: 500 });
  }
}
