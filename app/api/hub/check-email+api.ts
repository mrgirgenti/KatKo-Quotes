import { pool } from '@/lib/pool';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email')?.trim();
    if (!email) return Response.json({ error: 'email required' }, { status: 400 });

    const userResult = await pool.query(
      `SELECT u.id, u."firstName", u."lastName"
       FROM "User" u
       WHERE LOWER(u.email) = LOWER($1)
         AND u."userType" = 'CLIENT'
       LIMIT 1`,
      [email],
    );

    if (!userResult.rows.length) {
      return Response.json({ path: 'new', email });
    }

    const user = userResult.rows[0];
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || email;

    const memberResult = await pool.query(
      `SELECT om."organizationId", om.role, o.name AS "orgName", o."hubEnabled"
       FROM "OrganizationMembership" om
       JOIN "Organization" o ON o.id = om."organizationId"
       WHERE om."userId" = $1
       ORDER BY o."hubEnabled" DESC, om."createdAt" ASC
       LIMIT 1`,
      [user.id],
    );

    if (!memberResult.rows.length) {
      return Response.json({ path: 'new', email });
    }

    const m = memberResult.rows[0];
    if (m.hubEnabled) {
      return Response.json({ path: 'join', email, orgId: m.organizationId, orgName: m.orgName, userName });
    }
    return Response.json({ path: 'activate', email, orgId: m.organizationId, orgName: m.orgName, userName });
  } catch (err) {
    console.error('[GET /api/hub/check-email]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
