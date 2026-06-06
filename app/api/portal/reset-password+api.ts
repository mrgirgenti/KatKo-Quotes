import { pool } from '@/lib/pool';
import crypto from 'crypto';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const result = await pool.query(
      `SELECT id, email, "firstName", "lastName", "passwordResetExpiry"
       FROM "User" WHERE "passwordResetToken" = $1`,
      [token],
    );
    if (!result.rows[0]) {
      return Response.json({ error: 'Invalid or expired reset link.' }, { status: 404 });
    }
    const user = result.rows[0];
    if (new Date(user.passwordResetExpiry) < new Date()) {
      return Response.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 410 });
    }
    return Response.json({
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    });
  } catch (err) {
    console.error('[GET /api/portal/reset-password]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;
    if (!token || !password || password.length < 8) {
      return Response.json({ error: 'Token and password (min 8 chars) required' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT id, "passwordResetExpiry" FROM "User" WHERE "passwordResetToken" = $1`,
      [token],
    );
    if (!result.rows[0]) {
      return Response.json({ error: 'Invalid or expired reset link.' }, { status: 404 });
    }
    if (new Date(result.rows[0].passwordResetExpiry) < new Date()) {
      return Response.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 410 });
    }

    const passwordHash = hashPassword(password);
    await pool.query(
      `UPDATE "User"
       SET "passwordHash" = $1,
           "passwordResetToken" = NULL,
           "passwordResetExpiry" = NULL,
           status = 'ACTIVE'::"UserStatus",
           "updatedAt" = NOW()
       WHERE id = $2`,
      [passwordHash, result.rows[0].id],
    );

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/portal/reset-password]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
