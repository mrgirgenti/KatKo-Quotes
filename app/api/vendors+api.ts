import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get('active') !== 'false';

  const client = await pool.connect();
  try {
    const where = activeOnly ? `WHERE "isActive" = true` : '';
    const result = await client.query(
      `SELECT * FROM "Vendor" ${where} ORDER BY name ASC`,
    );
    return Response.json({ vendors: result.rows });
  } catch (err) {
    console.error('[GET /api/vendors]', err);
    return Response.json({ error: 'Failed to load vendors' }, { status: 500 });
  } finally {
    client.release();
  }
}
