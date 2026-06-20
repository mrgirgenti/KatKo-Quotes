import { pool } from '@/lib/pool';

export async function GET(_request: Request, { orgId }: { orgId: string }) {
  try {
    const result = await pool.query(
      `SELECT id, name, "hubEnabled", "logoUrl", "internalLogoUrl", phone, email FROM "Organization" WHERE id = $1`,
      [orgId]
    );
    if (!result.rows[0]) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }
    const org = result.rows[0];
    if (!org.hubEnabled) {
      return Response.json({ error: 'Hub not enabled for this organization' }, { status: 403 });
    }
    return Response.json({
      id: org.id,
      name: org.name,
      logoUrl: org.logoUrl || null,
      internalLogoUrl: org.internalLogoUrl || null,
      phone: org.phone || null,
      email: org.email || null,
    });
  } catch (err) {
    console.error('[GET /api/portal/[orgId]]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { orgId }: { orgId: string }) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const orgResult = await pool.query(
      `SELECT id, name, "hubEnabled" FROM "Organization" WHERE id = $1`,
      [orgId]
    );
    if (!orgResult.rows[0] || !orgResult.rows[0].hubEnabled) {
      return Response.json({ error: 'Hub not found or not enabled' }, { status: 403 });
    }
    const org = orgResult.rows[0];

    const memberResult = await pool.query(
      `SELECT u.id,
              TRIM(u."firstName" || ' ' || COALESCE(u."lastName", '')) AS name,
              u.email, u."userType", u.status, om.role,
              u."avatarColor", u."avatarUri"
       FROM "OrganizationMembership" om
       JOIN "User" u ON u.id = om."userId"
       WHERE om."organizationId" = $1
         AND LOWER(u.email) = LOWER($2)
         AND u."userType" = 'CLIENT'`,
      [orgId, email.trim()]
    );

    if (!memberResult.rows[0]) {
      return Response.json(
        { error: 'No client account found with that email for this organization.' },
        { status: 404 }
      );
    }

    const user = memberResult.rows[0];

    // Transition INVITED → ACTIVE on first portal login
    if (user.status === 'INVITED') {
      await pool.query(
        `UPDATE "User" SET status = 'ACTIVE'::"UserStatus", "updatedAt" = NOW() WHERE id = $1`,
        [user.id]
      );
    }

    return Response.json({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      orgName: org.name,
      orgId: org.id,
      avatarColor: user.avatarColor || '#FF5A00',
      avatarUri: user.avatarUri || null,
    });
  } catch (err) {
    console.error('[POST /api/portal/[orgId]]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { orgId }: { orgId: string }) {
  try {
    const body = await request.json();
    const callerUserId = body.callerUserId;
    if (!callerUserId) return Response.json({ error: 'callerUserId required' }, { status: 400 });

    const memberCheck = await pool.query(
      `SELECT om.role FROM "OrganizationMembership" om WHERE om."organizationId" = $1 AND om."userId" = $2`,
      [orgId, callerUserId]
    );
    if (!memberCheck.rows[0] || memberCheck.rows[0].role !== 'ORG_ADMIN') {
      return Response.json({ error: 'Only org admins can update the organization logo' }, { status: 403 });
    }

    await pool.query(
      `UPDATE "Organization" SET "logoUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [body.logoUrl || null, orgId]
    );
    return Response.json({ ok: true, logoUrl: body.logoUrl || null });
  } catch (err) {
    console.error('[PATCH /api/portal/[orgId]]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
