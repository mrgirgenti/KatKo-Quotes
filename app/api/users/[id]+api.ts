import { pool } from '@/lib/pool';

export async function PATCH(request: Request, { id }: { id: string }) {
  try {
    const body = await request.json();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.status !== undefined) {
      const allowed = ['ACTIVE', 'INVITED', 'DISABLED'];
      if (!allowed.includes(body.status)) {
        return Response.json({ error: `status must be one of: ${allowed.join(', ')}` }, { status: 400 });
      }
      fields.push(`status = $${idx++}::"UserStatus"`);
      values.push(body.status);
    }
    if (body.avatarColor !== undefined) {
      fields.push(`"avatarColor" = $${idx++}`);
      values.push(body.avatarColor || '#FF5A00');
    }

    if (fields.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });

    fields.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE "User" SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, status, "userType"`,
      values,
    );
    if (!result.rows[0]) return Response.json({ error: 'User not found' }, { status: 404 });
    return Response.json({ ok: true, ...result.rows[0] });
  } catch (err) {
    console.error('[PATCH /api/users/:id]', err);
    return Response.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { id }: { id: string }) {
  try {
    await pool.query(`DELETE FROM "User" WHERE id = $1 AND "userType" = 'CLIENT'`, [id]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/users/:id]', err);
    return Response.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
