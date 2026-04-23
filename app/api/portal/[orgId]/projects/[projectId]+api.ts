import { pool } from '@/lib/pool';

export async function GET(
  _req: Request,
  { orgId, projectId }: { orgId: string; projectId: string }
) {
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
        p."orderType",
        p."orderDate",
        p."inHandsDate",
        p."notesClient",
        p."lineItemsData",
        p."calculations",
        p."hasOnlineFee",
        p."hasSalesTax",
        p."hasCardFee",
        CASE p.status::text
          WHEN 'QUOTE_SENT' THEN 'QUOTED'
          WHEN 'DRAFT'      THEN 'NEEDS_REVIEW'
          ELSE p.status::text
        END AS status,
        p."createdAt"
      FROM "Project" p
      WHERE p."organizationId" = $1
        AND p.id = $2
        AND p.status != 'CANCELLED'::"ProjectStatus"`,
      [orgId, projectId]
    );

    if (!result.rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json(result.rows[0]);
  } catch (err) {
    console.error('[GET /api/portal/[orgId]/projects/[projectId]]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
