import { pool } from '@/lib/pool';
import { sendEmail } from '@/lib/email';
import crypto from 'crypto';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, orgId, password, invitees = [] } = body ?? {};
    if (!email || !orgId || !password) {
      return Response.json({ error: 'email, orgId, and password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    // Find the user
    const userResult = await pool.query(
      `SELECT u.id, u."firstName", u."lastName"
       FROM "User" u
       JOIN "OrganizationMembership" om ON om."userId" = u.id
       WHERE LOWER(u.email) = LOWER($1) AND om."organizationId" = $2 AND u."userType" = 'CLIENT'
       LIMIT 1`,
      [email.trim(), orgId],
    );
    if (!userResult.rows[0]) {
      return Response.json({ error: 'Account not found.' }, { status: 404 });
    }
    const user = userResult.rows[0];
    const passwordHash = hashPassword(password);

    // Set password + activate user + enable hub in a transaction
    await pool.query('BEGIN');
    try {
      await pool.query(
        `UPDATE "User" SET "passwordHash" = $1, status = 'ACTIVE'::"UserStatus", "updatedAt" = NOW() WHERE id = $2`,
        [passwordHash, user.id],
      );
      await pool.query(
        `UPDATE "Organization" SET "hubEnabled" = true, "updatedAt" = NOW() WHERE id = $1`,
        [orgId],
      );

      // Create invited users
      for (const inv of invitees as { name: string; email: string }[]) {
        if (!inv.email?.trim()) continue;
        const [fn, ...rest] = (inv.name || inv.email).split(' ');
        const ln = rest.join(' ') || null;
        const existing = await pool.query(
          `SELECT id FROM "User" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [inv.email.trim()],
        );
        let invUserId: string;
        if (existing.rows[0]) {
          invUserId = existing.rows[0].id;
        } else {
          const created = await pool.query(
            `INSERT INTO "User" ("id", "firstName", "lastName", "email", "userType", "status", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, 'CLIENT', 'INVITED'::"UserStatus", NOW(), NOW())
             RETURNING id`,
            [fn, ln, inv.email.trim().toLowerCase()],
          );
          invUserId = created.rows[0].id;
        }
        await pool.query(
          `INSERT INTO "OrganizationMembership" ("userId", "organizationId", "role", "createdAt", "updatedAt")
           VALUES ($1, $2, 'MEMBER', NOW(), NOW())
           ON CONFLICT ("userId", "organizationId") DO NOTHING`,
          [invUserId, orgId],
        );
      }

      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    // Notify admin
    const orgResult = await pool.query(`SELECT name FROM "Organization" WHERE id = $1`, [orgId]);
    const orgName = orgResult.rows[0]?.name || orgId;
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'hello@katalystko.com';
    await sendEmail({
      to: adminEmail,
      subject: `Client Hub Activated — ${orgName}`,
      html: `<p><strong>${user.firstName || email}</strong> has activated the Client Hub for <strong>${orgName}</strong>.</p>`,
      text: `${user.firstName || email} activated the Client Hub for ${orgName}.`,
    }).catch(() => {});

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/hub/activate]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
