import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const url = new URL(request.url);
  const serviceType = url.searchParams.get('serviceType') || null;
  const status      = url.searchParams.get('status') || null;
  const search      = url.searchParams.get('search') || null;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (serviceType) {
    params.push(serviceType);
    conditions.push(`"serviceType" = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`name ILIKE $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM "ProductionPricingPreset" ${where}
       ORDER BY "serviceType" ASC, "sortOrder" ASC, name ASC`,
      params,
    );
    return Response.json({ presets: result.rows });
  } catch (err) {
    console.error('[GET /api/production-presets]', err);
    return Response.json({ error: 'Failed to load presets' }, { status: 500 });
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

  const name        = typeof body.name        === 'string' ? body.name.trim()        : '';
  const serviceType = typeof body.serviceType === 'string' ? body.serviceType.trim() : '';
  if (!name)        return Response.json({ error: 'name is required' },        { status: 400 });
  if (!serviceType) return Response.json({ error: 'serviceType is required' }, { status: 400 });

  const suggestedSellPrice  = body.suggestedSellPrice  != null ? Number(body.suggestedSellPrice)  : null;
  const status              = typeof body.status        === 'string' ? body.status : 'Active';
  const maxWidth            = body.maxWidth             != null ? Number(body.maxWidth)            : null;
  const maxHeight           = body.maxHeight            != null ? Number(body.maxHeight)           : null;
  const defaultLocation     = typeof body.defaultLocation     === 'string' && body.defaultLocation.trim()     ? body.defaultLocation.trim()     : null;
  const defaultLocations    = typeof body.defaultLocations    === 'string' && body.defaultLocations.trim()    ? body.defaultLocations.trim()    : null;
  const defaultColorCount   = body.defaultColorCount != null ? parseInt(String(body.defaultColorCount), 10) : null;
  const suggestedStitchRange = typeof body.suggestedStitchRange === 'string' && body.suggestedStitchRange.trim() ? body.suggestedStitchRange.trim() : null;
  const notes               = typeof body.notes       === 'string' && body.notes.trim()       ? body.notes.trim()       : null;
  const sortOrder           = typeof body.sortOrder   === 'number'  ? body.sortOrder           : 0;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO "ProductionPricingPreset"
         (name, "serviceType", "suggestedSellPrice", status,
          "maxWidth", "maxHeight", "defaultLocation", "defaultLocations",
          "defaultColorCount", "suggestedStitchRange", notes, "sortOrder")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [name, serviceType, suggestedSellPrice, status,
       maxWidth, maxHeight, defaultLocation, defaultLocations,
       defaultColorCount, suggestedStitchRange, notes, sortOrder],
    );
    return Response.json({ preset: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/production-presets]', err);
    return Response.json({ error: 'Failed to create preset' }, { status: 500 });
  } finally {
    client.release();
  }
}
