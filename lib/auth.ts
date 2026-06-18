import { verifyToken, createClerkClient } from '@clerk/backend';
import { pool } from '@/lib/pool';

const secretKey = process.env.CLERK_SECRET_KEY ?? '';
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

const clerkClient = createClerkClient({ secretKey, publishableKey });

export type FrontendRole = 'org_admin' | 'user';

export interface AuthedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  internalRole: string;
  role: FrontendRole;
}

function internalRoleToFrontend(internalRole: string | null | undefined): FrontendRole {
  return internalRole === 'SUPER_ADMIN' ? 'org_admin' : 'user';
}

function rowToAuthedUser(row: any): AuthedUser {
  const firstName = row.firstName || '';
  const lastName = row.lastName || '';
  return {
    id: row.id,
    email: row.email || '',
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim() || row.email || 'User',
    internalRole: row.internalRole || 'SALES',
    role: internalRoleToFrontend(row.internalRole),
  };
}

// Resolve (and lazily provision) the DB User that corresponds to a verified
// Clerk identity. The DB remains the source of truth for roles; Clerk only
// supplies identity. The very first provisioned user becomes SUPER_ADMIN so the
// shop always has an org admin.
async function upsertDbUser(clerkUserId: string): Promise<AuthedUser | null> {
  const existing = await pool.query(
    `SELECT * FROM "User" WHERE "authProvider" = 'clerk' AND "authProviderUserId" = $1 LIMIT 1`,
    [clerkUserId],
  );
  if (existing.rows[0]) {
    pool
      .query(`UPDATE "User" SET "lastLoginAt" = NOW() WHERE id = $1`, [existing.rows[0].id])
      .catch(() => {});
    return rowToAuthedUser(existing.rows[0]);
  }

  // Pull profile from Clerk to populate the new DB row.
  let email = '';
  let firstName = '';
  let lastName = '';
  try {
    const cu = await clerkClient.users.getUser(clerkUserId);
    email =
      cu.primaryEmailAddress?.emailAddress ||
      cu.emailAddresses?.[0]?.emailAddress ||
      '';
    firstName = cu.firstName || '';
    lastName = cu.lastName || '';
  } catch {
    // If the profile lookup fails we still provision a minimal row keyed by id.
  }

  // Adopt an existing email-matched row (e.g. legacy/local user) instead of
  // creating a duplicate; attach the Clerk identity to it.
  if (email) {
    const byEmail = await pool.query(`SELECT * FROM "User" WHERE email = $1 LIMIT 1`, [email]);
    if (byEmail.rows[0]) {
      const updated = await pool.query(
        `UPDATE "User"
           SET "authProvider" = 'clerk', "authProviderUserId" = $1, "lastLoginAt" = NOW()
         WHERE id = $2 RETURNING *`,
        [clerkUserId, byEmail.rows[0].id],
      );
      return rowToAuthedUser(updated.rows[0]);
    }
  }

  const adminCount = await pool.query(
    `SELECT COUNT(*)::int AS c FROM "User" WHERE "internalRole" = 'SUPER_ADMIN'`,
  );
  const internalRole = (adminCount.rows[0]?.c ?? 0) === 0 ? 'SUPER_ADMIN' : 'SALES';

  const safeEmail = email || `${clerkUserId}@clerk.local`;
  const created = await pool.query(
    `INSERT INTO "User" (
        id, "firstName", "lastName", email, "userType", status,
        "authProvider", "authProviderUserId", "internalRole", "lastLoginAt",
        "createdAt", "updatedAt"
     ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'INTERNAL', 'ACTIVE',
        'clerk', $4, $5::"InternalRole", NOW(), NOW(), NOW()
     )
     ON CONFLICT (email) DO UPDATE
        SET "authProvider" = 'clerk', "authProviderUserId" = EXCLUDED."authProviderUserId",
            "lastLoginAt" = NOW()
     RETURNING *`,
    [firstName, lastName, safeEmail, clerkUserId, internalRole],
  );
  return rowToAuthedUser(created.rows[0]);
}

function extractToken(request: Request): string | null {
  const header =
    request.headers.get('authorization') || request.headers.get('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return null;
}

// Verify the Clerk session token on an API request and return the matching DB
// user (provisioning one if needed). Returns null when unauthenticated.
export async function authenticateRequest(request: Request): Promise<AuthedUser | null> {
  if (!secretKey) {
    console.error('[auth] CLERK_SECRET_KEY is not set');
    return null;
  }
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    console.error(
      '[auth] CLERK_SECRET_KEY has an unexpected format — expected sk_test_… or sk_live_… ' +
      '(check Replit secrets: you may have pasted the publishable key pk_… instead)',
    );
    return null;
  }
  const token = extractToken(request);
  if (!token) return null;

  let sub: string | undefined;
  try {
    // clockSkewInMs: tolerate up to 5 s of drift between client and server
    // clocks, preventing spurious "token used before issued" / "token expired"
    // errors on mobile devices whose clocks lag slightly.
    const claims = await verifyToken(token, { secretKey, clockSkewInMs: 5000 });
    sub = claims.sub;
  } catch (err) {
    console.error('[auth] token verification failed:', (err as Error)?.message);
    return null;
  }
  if (!sub) return null;

  try {
    return await upsertDbUser(sub);
  } catch (err) {
    console.error('[auth] failed to resolve DB user:', err);
    return null;
  }
}

export function unauthorized(message = 'Authentication required') {
  return Response.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'You do not have permission to do that') {
  return Response.json({ error: message }, { status: 403 });
}
