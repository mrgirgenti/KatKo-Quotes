import { pool } from '@/lib/pool';

export async function POST(request: Request, { id }: { id: string }) {
  try {
    const body = await request.json();
    const result = await pool.query(
      `INSERT INTO "Contact" (
        id, "organizationId", "firstName", "lastName", email, phone, role, notes, "isPrimary", "createdAt", "updatedAt"
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [
        id,
        body.firstName || '',
        body.lastName || '',
        body.email ?? null,
        body.phone ?? null,
        body.role ?? null,
        body.notes ?? null,
        body.isPrimary ?? false,
      ],
    );
    const c = result.rows[0];
    return Response.json(
      {
        id: c.id,
        organizationId: c.organizationId ?? undefined,
        firstName: c.firstName,
        lastName: c.lastName,
        role: c.role ?? undefined,
        email: c.email ?? undefined,
        phone: c.phone ?? undefined,
        notes: c.notes ?? undefined,
        isPrimary: c.isPrimary ?? false,
        createdAt: new Date(c.createdAt).toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[POST /api/orgs/:id/contacts]', err);
    return Response.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
