import { pool } from '@/lib/pool';

async function verifyMembership(orgId: string, userId: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM "OrganizationMembership" om
     JOIN "User" u ON u.id = om."userId"
     WHERE om."organizationId" = $1 AND u.id = $2 AND u."userType" = 'CLIENT'`,
    [orgId, userId]
  );
  return !!res.rows[0];
}

// List the project IDs the given customer has favorited within this org.
export async function GET(request: Request, params: { orgId: string }) {
  try {
    const { orgId } = params ?? {};
    if (!orgId) return Response.json({ error: 'Not found' }, { status: 404 });

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });

    if (!(await verifyMembership(orgId, userId))) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await pool.query(
      `SELECT "projectId" FROM "ProjectFavorite"
       WHERE "organizationId" = $1 AND "userId" = $2`,
      [orgId, userId]
    );
    return Response.json({ projectIds: result.rows.map(r => r.projectId) });
  } catch (err) {
    console.error('[GET /api/portal/[orgId]/favorites]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

// Toggle a favorite for the given customer + project.
// Body: { userId, projectId }. Returns { favorited: boolean }.
export async function POST(request: Request, params: { orgId: string }) {
  try {
    const { orgId } = params ?? {};
    if (!orgId) return Response.json({ error: 'Not found' }, { status: 404 });

    const { userId, projectId } = await request.json();
    if (!userId || !projectId) {
      return Response.json({ error: 'userId and projectId are required' }, { status: 400 });
    }

    if (!(await verifyMembership(orgId, userId))) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // The project must belong to this organization.
    const projCheck = await pool.query(
      `SELECT 1 FROM "Project" WHERE id = $1 AND "organizationId" = $2`,
      [projectId, orgId]
    );
    if (!projCheck.rows[0]) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const del = await pool.query(
      `DELETE FROM "ProjectFavorite"
       WHERE "userId" = $1 AND "projectId" = $2
       RETURNING id`,
      [userId, projectId]
    );

    if (del.rows[0]) {
      return Response.json({ favorited: false });
    }

    await pool.query(
      `INSERT INTO "ProjectFavorite" (id, "userId", "projectId", "organizationId", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())
       ON CONFLICT ("userId", "projectId") DO NOTHING`,
      [userId, projectId, orgId]
    );
    return Response.json({ favorited: true });
  } catch (err) {
    console.error('[POST /api/portal/[orgId]/favorites]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
