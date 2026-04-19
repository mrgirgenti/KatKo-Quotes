import { pool } from '@/lib/pool';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        o.id,
        o.name,
        o."hubEnabled",
        o."crmStatus",
        COUNT(om.id)::int                                            AS "totalMembers",
        COUNT(CASE WHEN u."userType" = 'CLIENT' THEN 1 END)::int    AS "clientUsers",
        MAX(CASE WHEN om.role = 'ORG_ADMIN' THEN
          TRIM(u."firstName" || ' ' || u."lastName")
        END)                                                         AS "orgAdminName",
        MAX(CASE WHEN om.role = 'ORG_ADMIN' THEN u."avatarColor" END) AS "orgAdminColor"
      FROM "Organization" o
      LEFT JOIN "OrganizationMembership" om ON om."organizationId" = o.id
      LEFT JOIN "User" u ON u.id = om."userId"
      WHERE o."hubEnabled" = true
      GROUP BY o.id, o.name, o."hubEnabled", o."crmStatus"
      ORDER BY o.name ASC
    `);
    return Response.json(result.rows);
  } catch (err) {
    console.error('[GET /api/client-hubs]', err);
    return Response.json({ error: 'Failed to load hub orgs' }, { status: 500 });
  }
}
