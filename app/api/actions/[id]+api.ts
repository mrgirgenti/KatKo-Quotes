import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function PUT(
  request: Request,
  params: { id: string }
) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();

    const { id } = params ?? {};
    if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const { status } = body as { status: 'VIEWED' | 'RESOLVED' };

    if (!['VIEWED', 'RESOLVED'].includes(status)) {
      return Response.json({ error: 'status must be VIEWED or RESOLVED' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const result = await pool.query(
      `UPDATE "ActionItem"
       SET
         status = $1,
         "viewedAt" = CASE WHEN $1 = 'VIEWED' AND "viewedAt" IS NULL THEN $2 ELSE "viewedAt" END,
         "resolvedAt" = CASE WHEN $1 = 'RESOLVED' AND "resolvedAt" IS NULL THEN $2 ELSE "resolvedAt" END
       WHERE id = $3
       RETURNING *`,
      [status, now, id]
    );

    if (!result.rows[0]) {
      return Response.json({ error: 'Action not found' }, { status: 404 });
    }

    return Response.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/actions/[id]]', err);
    return Response.json({ error: 'Failed to update action' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  params: { id: string }
) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();

    const { id } = params ?? {};
    if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

    await pool.query(`DELETE FROM "ActionItem" WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/actions/[id]]', err);
    return Response.json({ error: 'Failed to delete action' }, { status: 500 });
  }
}
