import { pool } from '@/lib/pool';

export async function PATCH(request: Request, { id }: { id: string }) {
  try {
    const body = await request.json();
    if (!body.role) return Response.json({ error: 'role required' }, { status: 400 });
    const result = await pool.query(
      `UPDATE "OrganizationMembership"
       SET role = $1::"MembershipRole"
       WHERE id = $2
       RETURNING id, role`,
      [body.role, id],
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(result.rows[0]);
  } catch (err) {
    console.error('[PATCH /api/memberships/:id]', err);
    return Response.json({ error: 'Failed to update membership' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { id }: { id: string }) {
  try {
    await pool.query(`DELETE FROM "OrganizationMembership" WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/memberships/:id]', err);
    return Response.json({ error: 'Failed to delete membership' }, { status: 500 });
  }
}
