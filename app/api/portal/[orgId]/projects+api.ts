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
        CASE p.status::text
          WHEN 'QUOTE_SENT' THEN 'QUOTED'
          WHEN 'DRAFT' THEN 'NEEDS_REVIEW'
          ELSE p.status::text
        END AS status,
        p."inHandsDate",
        p."orderDate",
        p."createdAt",
        (
          SELECT COUNT(*)::int
          FROM "ProjectItem" pi
          WHERE pi."projectId" = p.id
        ) AS "lineItemCount",
        -- Customer-facing totals come from the canonical Project JSON
        -- (Project.calculations), NOT the mostly-empty relational Quote table.
        NULLIF(p.calculations->>'total', '')::numeric          AS "totalCost",
        NULLIF(p.calculations->>'totalQuantity', '')::int      AS "pieces",
        NULLIF(p.calculations->>'totalPerPiece', '')::numeric  AS "perPiece"
      FROM "Project" p
      WHERE p."organizationId" = $1
        AND p.status != 'CANCELLED'::"ProjectStatus"
      ORDER BY p."createdAt" DESC
      LIMIT 100`,
      [orgId]
    );

    return Response.json(result.rows);
  } catch (err) {
    console.error('[GET /api/portal/[orgId]/projects]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
