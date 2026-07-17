import { pool } from '@/lib/pool';
import crypto from 'crypto';

function verifyPassword(stored: string, input: string): boolean {
  try {
    const parts = stored.split(':');
    if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
    const [, salt, hash] = parts;
    const inputHash = crypto.pbkdf2Sync(input, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(hash));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};
    if (!email || !password) {
      return Response.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const userResult = await pool.query(
      `SELECT u.id, u."firstName", u."lastName", u.email,
              u."passwordHash", u.status, u."avatarColor", u."avatarUri"
       FROM "User" u
       WHERE LOWER(u.email) = LOWER($1)
         AND u."userType" = 'CLIENT'
       LIMIT 1`,
      [email.trim()],
    );

    if (!userResult.rows[0]) {
      return Response.json({ error: 'No account found with that email address.' }, { status: 401 });
    }

    const user = userResult.rows[0];

    if (!user.passwordHash) {
      return Response.json(
        { error: 'Your account does not have a password yet. Use "Forgot your password?" to set one up.', needsSetup: true },
        { status: 401 },
      );
    }

    if (!verifyPassword(user.passwordHash, password)) {
      return Response.json({ error: 'Incorrect password. Please try again.' }, { status: 401 });
    }

    const memberResult = await pool.query(
      `SELECT om."organizationId", om.role, om."isPrimaryContact", om."canApproveQuotes",
              o.name AS "orgName", o."hubEnabled", o."logoUrl"
       FROM "OrganizationMembership" om
       JOIN "Organization" o ON o.id = om."organizationId"
       WHERE om."userId" = $1
         AND o."hubEnabled" = true
       ORDER BY om."createdAt" ASC`,
      [user.id],
    );

    if (!memberResult.rows.length) {
      return Response.json(
        { error: 'Your account is not linked to an active Client Hub. Contact your account manager.' },
        { status: 403 },
      );
    }

    if (user.status === 'INVITED') {
      await pool.query(
        `UPDATE "User" SET status = 'ACTIVE'::"UserStatus", "updatedAt" = NOW() WHERE id = $1`,
        [user.id],
      );
    }

    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    const baseSession = {
      userId: user.id,
      userName,
      userEmail: user.email,
      avatarColor: user.avatarColor || '#FF5A00',
      avatarUri: user.avatarUri || null,
    };

    if (memberResult.rows.length === 1) {
      const m = memberResult.rows[0];
      return Response.json({
        orgId: m.organizationId,
        orgs: null,
        session: {
          ...baseSession,
          role: m.role,
          isPrimaryContact: !!m.isPrimaryContact,
          canApproveQuotes: !!m.canApproveQuotes,
          orgName: m.orgName,
          orgId: m.organizationId,
        },
      });
    }

    return Response.json({
      orgId: null,
      orgs: memberResult.rows.map(m => ({
        orgId: m.organizationId,
        orgName: m.orgName,
        logoUrl: m.logoUrl || null,
        role: m.role,
      })),
      session: baseSession,
    });
  } catch (err) {
    console.error('[POST /api/hub/login]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
