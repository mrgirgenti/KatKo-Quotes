import { pool } from '@/lib/pool';
import { sendEmail, buildPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, orgId, email, name } = body;
    if (!userId || !email) {
      return Response.json({ error: 'userId and email required' }, { status: 400 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE "User" SET "passwordResetToken" = $1, "passwordResetExpiry" = $2, "updatedAt" = NOW() WHERE id = $3`,
      [token, expiry, userId],
    );

    const origin = request.headers.get('origin') || '';
    const resetUrl = `${origin}/portal/reset-password?token=${token}`;

    const { subject, html, text } = buildPasswordResetEmail({ clientName: name || 'there', resetUrl });
    await sendEmail({ to: email, subject, html, text });

    if (orgId) {
      try {
        await pool.query(
          `INSERT INTO "ActivityLog" (id, "organizationId", "actionType", "actionSummary", metadata, "createdAt")
           VALUES (gen_random_uuid(), $1, 'hub_password_reset', $2, $3, NOW())`,
          [orgId, `Password reset email sent to ${email}`, JSON.stringify({ email, userId })],
        );
      } catch {}
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/hub-reset-password]', err);
    return Response.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}
