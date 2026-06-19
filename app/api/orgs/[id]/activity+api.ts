import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

function toFrontendActivity(a: any) {
  const meta = a.metadata || {};
  return {
    id: a.id,
    type: a.actionType || 'note',
    date: meta.date || new Date(a.createdAt).toISOString().split('T')[0],
    subject: meta.subject ?? undefined,
    body: a.actionSummary || '',
    contactId: meta.contactId ?? undefined,
    contactName: meta.contactName ?? undefined,
    createdAt: new Date(a.createdAt).toISOString(),
  };
}

export async function POST(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  try {
    const body = await request.json();
    const meta = {
      date: body.date || new Date().toISOString().split('T')[0],
      subject: body.subject ?? null,
      contactId: body.contactId ?? null,
      contactName: body.contactName ?? null,
    };
    const result = await pool.query(
      `INSERT INTO "ActivityLog" (
        id, "organizationId", "actionType", "actionSummary", metadata, "createdAt"
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, NOW()) RETURNING *`,
      [id, body.type || 'note', body.body || '', JSON.stringify(meta)],
    );
    return Response.json(toFrontendActivity(result.rows[0]), { status: 201 });
  } catch (err) {
    console.error('[POST /api/orgs/:id/activity]', err);
    return Response.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}

export async function PUT(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  try {
    const body = await request.json();
    const meta = {
      date: body.date || new Date().toISOString().split('T')[0],
      subject: body.subject ?? null,
      contactId: body.contactId ?? null,
      contactName: body.contactName ?? null,
    };
    const result = await pool.query(
      `UPDATE "ActivityLog" SET
        "actionType" = $1, "actionSummary" = $2, metadata = $3::jsonb
      WHERE id = $4 RETURNING *`,
      [body.type, body.body || '', JSON.stringify(meta), body.id],
    );
    return Response.json(toFrontendActivity(result.rows[0]));
  } catch (err) {
    return Response.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  try {
    const body = await request.json();
    await pool.query(`DELETE FROM "ActivityLog" WHERE id = $1`, [body.entryId]);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}
