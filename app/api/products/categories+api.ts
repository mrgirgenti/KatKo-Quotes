import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT DISTINCT category
      FROM "Product"
      WHERE "isActive" = true
        AND category IS NOT NULL
        AND category <> ''
      ORDER BY category
    `);
    return Response.json({ categories: result.rows.map((r: any) => r.category as string) });
  } finally {
    client.release();
  }
}
