import { pool } from '@/lib/pool';

function parseNameParts(name: string): { firstName: string; lastName: string } {
  const parts = (name || 'User').trim().split(/\s+/);
  return {
    firstName: parts[0] || 'User',
    lastName: parts.slice(1).join(' ') || '',
  };
}

function mapRoleToInternal(role: string): string {
  return role === 'org_admin' ? 'SUPER_ADMIN' : 'SALES';
}

function toFrontendUser(u: any) {
  const email = u.email || '';
  return {
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.firstName,
    email: email.endsWith('@noemail.internal') ? '' : email,
    phone: u.phone || '',
    avatarColor: u.avatarColor || '#FF5A00',
    profilePicture: u.avatarUri || undefined,
    role: u.internalRole === 'SUPER_ADMIN' ? 'org_admin' : 'user',
    status: u.status,
    userType: u.userType,
    createdAt: new Date(u.createdAt).toISOString(),
  };
}

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT * FROM "User" WHERE "userType" = 'INTERNAL' AND status != 'DISABLED' ORDER BY "createdAt" ASC`,
    );
    return Response.json(result.rows.map(toFrontendUser));
  } catch (err) {
    console.error('[GET /api/users]', err);
    return Response.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });

    const { firstName, lastName } = parseNameParts(body.name || '');
    const email = `${body.id}@noemail.internal`;
    const internalRole = mapRoleToInternal(body.role || 'user');

    const result = await pool.query(
      `INSERT INTO "User" (
        id, "firstName", "lastName", email, phone,
        "userType", status, "internalRole", "avatarColor", "avatarUri",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        'INTERNAL'::"UserType", 'ACTIVE'::"UserStatus", $6::"InternalRole", $7, $8,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        "firstName" = EXCLUDED."firstName",
        "lastName"  = EXCLUDED."lastName",
        phone       = EXCLUDED.phone,
        "internalRole" = EXCLUDED."internalRole",
        "avatarColor"  = EXCLUDED."avatarColor",
        "avatarUri"    = EXCLUDED."avatarUri",
        "updatedAt"    = NOW()
      RETURNING *`,
      [
        body.id,
        firstName,
        lastName,
        email,
        body.phone || null,
        internalRole,
        body.avatarColor || '#FF5A00',
        body.profilePicture || null,
      ],
    );
    return Response.json(toFrontendUser(result.rows[0]), { status: 201 });
  } catch (err: any) {
    if (err?.code === '23505') {
      // Race condition — concurrent sync already inserted this user; that's fine
      return new Response(null, { status: 204 });
    }
    console.error('[POST /api/users]', err);
    return Response.json({ error: 'Failed to sync user' }, { status: 500 });
  }
}
