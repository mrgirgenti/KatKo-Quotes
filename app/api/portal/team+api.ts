import { pool } from '@/lib/pool';
import { randomUUID } from 'crypto';

async function getCallerRole(orgId: string, userId: string) {
  const r = await pool.query(
    `SELECT role FROM "OrganizationMembership" WHERE "organizationId" = $1 AND "userId" = $2`,
    [orgId, userId]
  );
  return r.rows[0]?.role as string | undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 });

  try {
    const result = await pool.query(
      `SELECT u.id, TRIM(u."firstName" || ' ' || COALESCE(u."lastName", '')) AS name,
              u.email, u.status, om.role, om."isPrimaryContact", om."canManageUsers",
              u."createdAt"
       FROM "OrganizationMembership" om
       JOIN "User" u ON u.id = om."userId"
       WHERE om."organizationId" = $1
         AND u."userType" = 'CLIENT'
       ORDER BY om.role, u."firstName"`,
      [orgId]
    );
    return Response.json({ members: result.rows });
  } catch (err) {
    console.error('[GET /api/portal/team]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { orgId, callerUserId, email } = body;

  if (!orgId || !callerUserId || !email)
    return Response.json({ error: 'orgId, callerUserId, and email are required' }, { status: 400 });

  const callerRole = await getCallerRole(orgId, callerUserId);
  if (callerRole !== 'ORG_ADMIN')
    return Response.json({ error: 'Only Organization Admins can add members.' }, { status: 403 });

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await pool.query(
      `SELECT id, "userType" FROM "User" WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );

    let userId: string;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      const alreadyMember = await pool.query(
        `SELECT id FROM "OrganizationMembership" WHERE "organizationId" = $1 AND "userId" = $2`,
        [orgId, userId]
      );
      if (alreadyMember.rows.length > 0)
        return Response.json({ error: 'This user is already a member of your organization.' }, { status: 409 });
    } else {
      const newId = randomUUID();
      const emailParts = normalizedEmail.split('@');
      const firstName = emailParts[0] || 'Invited';
      await pool.query(
        `INSERT INTO "User" (id, "firstName", "lastName", email, "userType", status, "createdAt", "updatedAt")
         VALUES ($1, $2, '', $3, 'CLIENT'::"UserType", 'INVITED'::"UserStatus", NOW(), NOW())`,
        [newId, firstName, normalizedEmail]
      );
      userId = newId;
    }

    await pool.query(
      `INSERT INTO "OrganizationMembership" (id, "organizationId", "userId", role, "createdAt")
       VALUES ($1, $2, $3, 'MEMBER'::"MembershipRole", NOW())`,
      [randomUUID(), orgId, userId]
    );

    const newMember = await pool.query(
      `SELECT u.id, TRIM(u."firstName" || ' ' || COALESCE(u."lastName", '')) AS name,
              u.email, u.status, om.role
       FROM "OrganizationMembership" om
       JOIN "User" u ON u.id = om."userId"
       WHERE om."organizationId" = $1 AND om."userId" = $2`,
      [orgId, userId]
    );

    return Response.json({ member: newMember.rows[0] });
  } catch (err) {
    console.error('[POST /api/portal/team]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
