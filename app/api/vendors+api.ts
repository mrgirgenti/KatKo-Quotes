import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get('active') !== 'false';

  const client = await pool.connect();
  try {
    const where = activeOnly ? `WHERE v."isActive" = true` : '';
    const result = await client.query(
      `SELECT v.*, COUNT(pv.id)::int AS "sourceCount"
       FROM "Vendor" v
       LEFT JOIN "ProductVendor" pv ON pv."vendorId" = v.id
       ${where}
       GROUP BY v.id
       ORDER BY v.name ASC`,
    );
    return Response.json({ vendors: result.rows });
  } catch (err) {
    console.error('[GET /api/vendors]', err);
    return Response.json({ error: 'Failed to load vendors' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const website    = typeof body.website    === 'string' && body.website.trim()    ? body.website.trim()    : null;
  const catalogUrl = typeof body.catalogUrl === 'string' && body.catalogUrl.trim() ? body.catalogUrl.trim() : null;
  const notes      = typeof body.notes      === 'string' && body.notes.trim()      ? body.notes.trim()      : null;
  const apiProvider = typeof body.apiProvider === 'string' && body.apiProvider.trim() ? body.apiProvider.trim() : null;
  const isActive           = body.isActive           === undefined ? true  : Boolean(body.isActive);
  const apiEnabled         = body.apiEnabled         === undefined ? false : Boolean(body.apiEnabled);
  const importEnabled      = body.importEnabled      === undefined ? false : Boolean(body.importEnabled);
  const productImportEnabled = body.productImportEnabled === undefined ? false : Boolean(body.productImportEnabled);
  const colorImportEnabled   = body.colorImportEnabled   === undefined ? false : Boolean(body.colorImportEnabled);
  const pricingSyncEnabled   = body.pricingSyncEnabled   === undefined ? false : Boolean(body.pricingSyncEnabled);
  const inventorySyncEnabled = body.inventorySyncEnabled === undefined ? false : Boolean(body.inventorySyncEnabled);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO "Vendor" (name, website, "catalogUrl", notes, "isActive",
         "apiEnabled", "apiProvider", "importEnabled", "productImportEnabled",
         "colorImportEnabled", "pricingSyncEnabled", "inventorySyncEnabled")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [name, website, catalogUrl, notes, isActive,
       apiEnabled, apiProvider, importEnabled, productImportEnabled,
       colorImportEnabled, pricingSyncEnabled, inventorySyncEnabled],
    );
    return Response.json({ vendor: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: 'A vendor with this name already exists' }, { status: 409 });
    }
    console.error('[POST /api/vendors]', err);
    return Response.json({ error: 'Failed to create vendor' }, { status: 500 });
  } finally {
    client.release();
  }
}
