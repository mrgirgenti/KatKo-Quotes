import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const client = await pool.connect();
  try {
    const tRes = await client.query(
      `SELECT * FROM "PlacementTemplate" ORDER BY "createdAt" ASC`,
    );
    const templates = tRes.rows;

    if (templates.length > 0) {
      const ids = templates.map(t => t.id);
      const pRes = await client.query(
        `SELECT * FROM "TemplatePlacement"
         WHERE "templateId" = ANY($1::text[])
         ORDER BY "templateId" ASC, "sortOrder" ASC, "createdAt" ASC`,
        [ids],
      );
      const byTemplate: Record<string, unknown[]> = {};
      for (const p of pRes.rows) {
        if (!byTemplate[p.templateId]) byTemplate[p.templateId] = [];
        byTemplate[p.templateId].push(p);
      }
      for (const t of templates) {
        t.placements = byTemplate[t.id] || [];
      }
    }

    return Response.json({ templates });
  } catch (err) {
    console.error('[GET /api/products/placement-templates]', err);
    return Response.json({ error: 'Failed to load templates' }, { status: 500 });
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

  const { key, name, description } = body as Record<string, string>;
  if (!key?.trim()) return Response.json({ error: 'key is required' }, { status: 400 });
  if (!name?.trim()) return Response.json({ error: 'name is required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO "PlacementTemplate" (id, key, name, description)
       VALUES (gen_random_uuid()::text, $1, $2, $3)
       RETURNING *`,
      [key.trim().toUpperCase(), name.trim(), description?.trim() || null],
    );
    return Response.json({ template: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') return Response.json({ error: 'Template key already exists' }, { status: 409 });
    console.error('[POST /api/products/placement-templates]', err);
    return Response.json({ error: 'Failed to create template' }, { status: 500 });
  } finally {
    client.release();
  }
}
