import { pool } from '@/lib/pool';

function toEntry(a: any) {
  const meta = a.metadata || {};
  return {
    id: a.id,
    actionType: a.actionType || 'note',
    summary: a.actionSummary || '',
    metadata: meta,
    createdAt: new Date(a.createdAt).toISOString(),
  };
}

export async function GET(_req: Request, { id }: { id: string }) {
  if (!id) return Response.json({ activities: [] });
  try {
    const result = await pool.query(
      `SELECT * FROM "ActivityLog" WHERE "projectId" = $1 ORDER BY "createdAt" DESC LIMIT 100`,
      [id],
    );
    return Response.json({ activities: result.rows.map(toEntry) });
  } catch (err) {
    console.error('[GET /api/projects/:id/activity]', err);
    return Response.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
