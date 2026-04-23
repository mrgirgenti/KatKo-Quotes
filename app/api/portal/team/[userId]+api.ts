import { pool } from '@/lib/pool';

async function getCallerRole(orgId: string, userId: string) {
  const r = await pool.query(
    `SELECT role FROM "OrganizationMembership" WHERE "organizationId" = $1 AND "userId" = $2`,
    [orgId, userId]
  );
  return r.rows[0]?.role as string | undefined;
}

export async function DELETE(request: Request, { userId }: { userId: string }) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  const callerUserId = url.searchParams.get('callerUserId');

  if (!orgId || !callerUserId || !userId)
    return Response.json({ error: 'orgId, callerUserId required' }, { status: 400 });

  const callerRole = await getCallerRole(orgId, callerUserId);
  if (callerRole !== 'ORG_ADMIN')
    return Response.json({ error: 'Only Organization Admins can remove members.' }, { status: 403 });

  if (userId === callerUserId)
    return Response.json({ error: 'You cannot remove yourself.' }, { status: 400 });

  try {
    await pool.query(
      `DELETE FROM "OrganizationMembership" WHERE "organizationId" = $1 AND "userId" = $2`,
      [orgId, userId]
    );
    return Response.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/portal/team/[userId]]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
