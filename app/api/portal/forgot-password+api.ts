import { pool } from '@/lib/pool';
import { sendEmail, buildPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, orgId } = body;
    if (!email || !orgId) {
      return Response.json({ error: 'email and orgId required' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT u.id, TRIM(u."firstName" || ' ' || COALESCE(u."lastName", '')) AS name, u.email
       FROM "User" u
       JOIN "OrganizationMembership" om ON om."userId" = u.id
       WHERE om."organizationId" = $1
         AND LOWER(u.email) = LOWER($2)
         AND u."userType" = 'CLIENT'
       LIMIT 1`,
      [orgId, email.trim()],
    );

    if (!result.rows[0]) {
      return Response.json({ ok: true });
    }

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE "User" SET "passwordResetToken" = $1, "passwordResetExpiry" = $2, "updatedAt" = NOW() WHERE id = $3`,
      [token, expiry, user.id],
    );

    const origin = request.headers.get('origin') || '';
    const resetUrl = `${origin}/portal/reset-password?token=${token}`;
    const { subject, html, text } = buildPasswordResetEmail({ clientName: user.name || 'there', resetUrl });
    await sendEmail({ to: user.email, subject, html, text });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/portal/forgot-password]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
