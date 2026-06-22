import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function PATCH(request: Request, { id, contactId }: { id: string; contactId: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  try {
    const body = await request.json();
    if (body.linkedUserId !== undefined) {
      await pool.query(
        `UPDATE "Contact" SET "linkedUserId" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [body.linkedUserId || null, contactId],
      );
    }
    const result = await pool.query(`SELECT * FROM "Contact" WHERE id = $1`, [contactId]);
    const c = result.rows[0];
    if (!c) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ id: c.id, linkedUserId: c.linkedUserId ?? null });
  } catch (err) {
    console.error('[PATCH /api/orgs/:id/contacts/:contactId]', err);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function PUT(request: Request, { id, contactId }: { id: string; contactId: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

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
    // linkedUserId is the authoritative Contact ↔ User key; update it only when
    // explicitly provided so normal edits never clobber an existing link.
    let linkedUserId = result.rows[0]?.linkedUserId ?? null;
    if (body.linkedUserId !== undefined) {
      linkedUserId = body.linkedUserId || null;
      await pool.query(
        `UPDATE "Contact" SET "linkedUserId" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [linkedUserId, contactId],
      );
    }
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
      linkedUserId: linkedUserId ?? undefined,
      createdAt: new Date(c.createdAt).toISOString(),
    });
  } catch (err) {
    console.error('[PUT /api/orgs/:id/contacts/:contactId]', err);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { id, contactId }: { id: string; contactId: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  try {
    await pool.query(`DELETE FROM "Contact" WHERE id = $1`, [contactId]);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
