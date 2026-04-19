import { pool } from '@/lib/pool';

function toFrontendMembership(m: any) {
  const email = m.userEmail || '';
  return {
    id: m.id,
    organizationId: m.organizationId,
    userId: m.userId,
    role: m.role as string,
    isPrimaryContact: m.isPrimaryContact ?? false,
    canManageUsers: m.canManageUsers ?? false,
    canSubmitProjects: m.canSubmitProjects ?? true,
    canViewProjects: m.canViewProjects ?? true,
    canViewInvoices: m.canViewInvoices ?? false,
    canPayInvoices: m.canPayInvoices ?? false,
    canApproveQuotes: m.canApproveQuotes ?? false,
    createdAt: new Date(m.createdAt).toISOString(),
    userName: m.userName || undefined,
    userEmail: email.endsWith('@noemail.internal') ? '' : email,
    userAvatarColor: m.userAvatarColor || undefined,
  };
}

async function fetchMembershipWithUser(membershipId: string) {
  const result = await pool.query(
    `SELECT om.*,
       TRIM(u."firstName" || ' ' || u."lastName") AS "userName",
       u.email AS "userEmail",
       u."avatarColor" AS "userAvatarColor"
     FROM "OrganizationMembership" om
     JOIN "User" u ON om."userId" = u.id
     WHERE om.id = $1`,
    [membershipId],
  );
  return result.rows[0] || null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId');
    if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 });

    const result = await pool.query(
      `SELECT om.*,
         TRIM(u."firstName" || ' ' || u."lastName") AS "userName",
         u.email AS "userEmail",
         u."avatarColor" AS "userAvatarColor"
       FROM "OrganizationMembership" om
       JOIN "User" u ON om."userId" = u.id
       WHERE om."organizationId" = $1
       ORDER BY om."createdAt" ASC`,
      [orgId],
    );
    return Response.json(result.rows.map(toFrontendMembership));
  } catch (err) {
    console.error('[GET /api/memberships]', err);
    return Response.json({ error: 'Failed to load memberships' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.userId) {
      return Response.json({ error: 'organizationId and userId required' }, { status: 400 });
    }

    const upsertResult = await pool.query(
      `INSERT INTO "OrganizationMembership" (
        id, "organizationId", "userId", role,
        "isPrimaryContact", "canManageUsers", "canSubmitProjects",
        "canViewProjects", "canViewInvoices", "canPayInvoices", "canApproveQuotes",
        "createdAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3::"MembershipRole",
        $4, $5, $6, $7, $8, $9, $10, NOW()
      )
      ON CONFLICT ("organizationId", "userId") DO UPDATE SET
        role             = EXCLUDED.role,
        "canManageUsers" = EXCLUDED."canManageUsers",
        "canViewInvoices" = EXCLUDED."canViewInvoices",
        "canPayInvoices"  = EXCLUDED."canPayInvoices",
        "canApproveQuotes" = EXCLUDED."canApproveQuotes"
      RETURNING id`,
      [
        body.organizationId,
        body.userId,
        body.role || 'MEMBER',
        body.isPrimaryContact ?? false,
        body.canManageUsers ?? false,
        body.canSubmitProjects ?? true,
        body.canViewProjects ?? true,
        body.canViewInvoices ?? false,
        body.canPayInvoices ?? false,
        body.canApproveQuotes ?? false,
      ],
    );

    const full = await fetchMembershipWithUser(upsertResult.rows[0].id);
    return Response.json(toFrontendMembership(full), { status: 201 });
  } catch (err) {
    console.error('[POST /api/memberships]', err);
    return Response.json({ error: 'Failed to create membership' }, { status: 500 });
  }
}
