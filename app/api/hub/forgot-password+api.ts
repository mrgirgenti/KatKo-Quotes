import { pool } from '@/lib/pool';
import { sendEmail, buildPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email?.trim();
    if (!email) return Response.json({ ok: true });

    const result = await pool.query(
      `SELECT id, email, "firstName", "lastName"
       FROM "User"
       WHERE LOWER(email) = LOWER($1)
         AND "userType" = 'CLIENT'
       LIMIT 1`,
      [email],
    );

    if (result.rows[0]) {
      const user = result.rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await pool.query(
        `UPDATE "User" SET "passwordResetToken" = $1, "passwordResetExpiry" = $2, "updatedAt" = NOW() WHERE id = $3`,
        [token, expiry, user.id],
      );

      const origin = request.headers.get('origin') || '';
      const resetUrl = `${origin}/hub-login/reset?token=${token}`;
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';
      const { subject, html, text } = buildPasswordResetEmail({ clientName: name, resetUrl });
      await sendEmail({ to: user.email, subject, html, text });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/hub/forgot-password]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
