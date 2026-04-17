import { pool } from '@/lib/pool';

export async function PUT(request: Request, { id, contactId }: { id: string; contactId: string }) {
  try {
    const body = await request.json();
    const result = await pool.query(
      `UPDATE "Contact" SET
        "firstName" = $1, "lastName" = $2, email = $3, phone = $4, role = $5,
        notes = $6, "isPrimary" = $7, "updatedAt" = NOW()
      WHERE id = $8 RETURNING *`,
      [
        body.firstName,
        body.lastName,
        body.email ?? null,
        body.phone ?? null,
        body.role ?? null,
        body.notes ?? null,
        body.isPrimary ?? false,
        contactId,
      ],
    );
    const c = result.rows[0];
    return Response.json({
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
    });
  } catch (err) {
    console.error('[PUT /api/orgs/:id/contacts/:contactId]', err);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { id, contactId }: { id: string; contactId: string }) {
  try {
    await pool.query(`DELETE FROM "Contact" WHERE id = $1`, [contactId]);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
