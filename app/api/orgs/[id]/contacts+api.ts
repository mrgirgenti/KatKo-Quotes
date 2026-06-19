import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

function toContact(c: any) {
  return {
    id: c.id,
    organizationId: c.organizationId ?? undefined,
    firstName: c.firstName,
    lastName: c.lastName,
    role: c.role ?? undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    notes: c.notes ?? undefined,
    isPrimary: c.isPrimary ?? false,
    linkedUserId: c.linkedUserId ?? undefined,
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

export async function POST(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  try {
    const body = await request.json();

    if (body.email) {
      const existing = await pool.query(
        `SELECT id FROM "Contact" WHERE "organizationId" = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
        [id, body.email],
      );
      if (existing.rows[0]) {
        const updated = await pool.query(
          `UPDATE "Contact"
           SET "linkedUserId" = $1, "updatedAt" = NOW()
           WHERE id = $2
           RETURNING *`,
          [body.linkedUserId ?? null, existing.rows[0].id],
        );
        const c = updated.rows[0];
        return Response.json(toContact(c), { status: 200 });
      }
    }

    const result = await pool.query(
      `INSERT INTO "Contact" (
        id, "organizationId", "firstName", "lastName", email, phone, role,
        notes, "isPrimary", "linkedUserId", "createdAt", "updatedAt"
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      [
        id,
        body.firstName || '',
        body.lastName || '',
        body.email ?? null,
        body.phone ?? null,
        body.role ?? null,
        body.notes ?? null,
        body.isPrimary ?? false,
        body.linkedUserId ?? null,
      ],
    );
    return Response.json(toContact(result.rows[0]), { status: 201 });
  } catch (err) {
    console.error('[POST /api/orgs/:id/contacts]', err);
    return Response.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
