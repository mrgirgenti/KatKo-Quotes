import { pool } from '@/lib/pool';

export async function DELETE(_req: Request, { id }: { id: string }) {
  try {
    await pool.query(`DELETE FROM "OrganizationMembership" WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/memberships/:id]', err);
    return Response.json({ error: 'Failed to delete membership' }, { status: 500 });
  }
}
