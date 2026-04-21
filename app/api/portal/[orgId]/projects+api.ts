import { pool } from '@/lib/pool';

export async function GET(_req: Request, { orgId }: { orgId: string }) {
  try {
    const orgResult = await pool.query(
      `SELECT id, "hubEnabled" FROM "Organization" WHERE id = $1`,
      [orgId]
    );
    if (!orgResult.rows[0] || !orgResult.rows[0].hubEnabled) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await pool.query(
      `SELECT
        p.id,
        p.title,
        p."frontendStatus" AS status,
        p."inHandsDate",
        p."createdAt",
        COUNT(li.id)::int AS "lineItemCount"
      FROM "Project" p
      LEFT JOIN "LineItem" li ON li."projectId" = p.id
      WHERE p."organizationId" = $1
        AND p."frontendStatus" != 'CANCELLED'
      GROUP BY p.id
      ORDER BY p."createdAt" DESC
      LIMIT 50`,
      [orgId]
    );

    return Response.json(result.rows);
  } catch (err) {
    console.error('[GET /api/portal/[orgId]/projects]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
