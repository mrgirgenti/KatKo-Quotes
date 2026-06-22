import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized, forbidden } from '@/lib/auth';
import { formatPhoneOrNull } from '@/utils/phone';

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

export async function GET(request: Request) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();
    const url = new URL(request.url);
    const type = url.searchParams.get('type'); // 'internal' | 'client' | null (all)
    let query = `SELECT * FROM "User" WHERE status != 'DISABLED'`;
    if (type === 'client') {
      query += ` AND "userType" = 'CLIENT'`;
    } else if (!type || type === 'internal') {
      query += ` AND "userType" = 'INTERNAL'`;
    }
    query += ` ORDER BY "createdAt" ASC`;
    const result = await pool.query(query);
    return Response.json(result.rows.map(toFrontendUser));
  } catch (err) {
    console.error('[GET /api/users]', err);
    return Response.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();
    const body = await request.json();
    if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });

    const isClientUser = body.userType === 'CLIENT';
    const { firstName, lastName } = parseNameParts(body.name || '');

    if (isClientUser) {
      // Client users require a real email
      if (!body.email) return Response.json({ error: 'email required for client users' }, { status: 400 });

      // Check if a user with this email already exists — if so, return them so the
      // caller uses the correct existing ID (avoids FK violations on OrganizationMembership).
      const existing = await pool.query(
        `SELECT * FROM "User" WHERE LOWER(email) = LOWER($1)`,
        [body.email.trim()],
      );
      if (existing.rows[0]) {
        return Response.json(toFrontendUser(existing.rows[0]), { status: 200 });
      }

      const result = await pool.query(
        `INSERT INTO "User" (
          id, "firstName", "lastName", email, phone,
          "userType", status, "internalRole", "avatarColor",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          'CLIENT'::"UserType", 'INVITED'::"UserStatus", 'SALES'::"InternalRole", $6,
          NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          "firstName"  = EXCLUDED."firstName",
          "lastName"   = EXCLUDED."lastName",
          phone        = EXCLUDED.phone,
          "avatarColor" = EXCLUDED."avatarColor",
          "updatedAt"  = NOW()
        RETURNING *`,
        [body.id, firstName, lastName, body.email.trim(), formatPhoneOrNull(body.phone), body.avatarColor || '#6366F1'],
      );
      return Response.json(toFrontendUser(result.rows[0]), { status: 201 });
    }

    // Internal user sync.
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
        "avatarColor"  = EXCLUDED."avatarColor",
        "avatarUri"    = EXCLUDED."avatarUri",
        "updatedAt"    = NOW()
      RETURNING *`,
      [
        body.id,
        firstName,
        lastName,
        email,
        formatPhoneOrNull(body.phone),
        internalRole,
        body.avatarColor || '#FF5A00',
        body.profilePicture || null,
      ],
    );
    return Response.json(toFrontendUser(result.rows[0]), { status: 201 });
  } catch (err: any) {
    if (err?.code === '23505') {
      // Race condition on email unique — concurrent sync already inserted; that's fine
      return new Response(null, { status: 204 });
    }
    console.error('[POST /api/users]', err);
    return Response.json({ error: 'Failed to sync user' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();
    const body = await request.json();
    if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.avatarColor !== undefined) {
      fields.push(`"avatarColor" = $${idx++}`);
      values.push(body.avatarColor || '#FF5A00');
    }
    if (body.avatarUri !== undefined) {
      fields.push(`"avatarUri" = $${idx++}`);
      values.push(body.avatarUri || null);
    }

    if (fields.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });

    fields.push(`"updatedAt" = NOW()`);
    values.push(body.id);

    const result = await pool.query(
      `UPDATE "User" SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (!result.rows[0]) return Response.json({ error: 'User not found' }, { status: 404 });
    return Response.json(toFrontendUser(result.rows[0]));
  } catch (err) {
    console.error('[PATCH /api/users]', err);
    return Response.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
