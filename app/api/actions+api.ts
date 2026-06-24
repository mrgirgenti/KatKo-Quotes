import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import type { ActionItem, ActionStatus } from '@/lib/actions';

export async function GET(request: Request) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');

    const categoryTypeMap: Record<string, string[]> = {
      NEEDS_REVIEW: ['NEW_QUOTE_SUBMISSION', 'QUOTE_MISSING_INFORMATION', 'QUOTE_RETURNED_FOR_REVISION'],
      CUSTOMER_REQUESTS: ['QUOTE_REVISION_REQUEST', 'ARTWORK_UPLOADED', 'CUSTOMER_COMMENT'],
      PRODUCTION_ISSUES: ['MISSING_ARTWORK', 'MOCKUP_APPROVAL_REQUIRED', 'PRODUCTION_ISSUE_REPORTED'],
      SYSTEM_ALERTS: ['QUOTE_DELIVERY_FAILED', 'INVOICE_DELIVERY_FAILED', 'EMAIL_BOUNCE', 'PAYMENT_LINK_FAILED', 'PDF_GENERATION_FAILED'],
    };

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (status && status !== 'ALL') {
      whereClause += ` AND a.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (category && categoryTypeMap[category]) {
      whereClause += ` AND a.type = ANY($${paramIdx}::text[])`;
      params.push(categoryTypeMap[category]);
      paramIdx++;
    }

    const result = await pool.query(
      `SELECT
        a.*,
        p.title AS "projectTitle",
        p."projectNumber",
        p."clientName" AS "orgName",
        o.name AS "organizationName"
       FROM "ActionItem" a
       LEFT JOIN "Project" p ON p.id = a."projectId"
       LEFT JOIN "Organization" o ON o.id = a."organizationId"
       ${whereClause}
       ORDER BY
         CASE a.priority
           WHEN 'CRITICAL' THEN 1
           WHEN 'HIGH' THEN 2
           WHEN 'NORMAL' THEN 3
           WHEN 'LOW' THEN 4
           ELSE 5
         END,
         a."createdAt" DESC
       LIMIT 500`,
      params
    );

    return Response.json(result.rows.map(row => ({
      id: row.id,
      type: row.type,
      priority: row.priority,
      status: row.status,
      organizationId: row.organizationId,
      projectId: row.projectId,
      title: row.title,
      description: row.description,
      metadata: row.metadata,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      viewedAt: row.viewedAt,
      projectTitle: row.projectTitle,
      projectNumber: row.projectNumber,
      organizationName: row.organizationName || row.orgName,
    })));
  } catch (err) {
    console.error('[GET /api/actions]', err);
    return Response.json({ error: 'Failed to load actions' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();
    const body = await request.json().catch(() => ({}));
    if (body.action === 'mark_all_read') {
      await pool.query(
        `UPDATE "ActionItem" SET status = 'VIEWED', "viewedAt" = NOW() WHERE status = 'NEW'`
      );
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[PUT /api/actions]', err);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();

    const body = await request.json();
    const { type, title, description, organizationId, projectId, priority, metadata } = body;

    if (!type || !title) {
      return Response.json({ error: 'type and title are required' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO "ActionItem" (
        id, type, priority, status, "organizationId", "projectId",
        title, description, metadata, "createdAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, 'NEW', $3, $4, $5, $6, $7::jsonb, NOW()
      ) RETURNING *`,
      [type, priority ?? 'NORMAL', organizationId ?? null, projectId ?? null, title, description ?? null, metadata ? JSON.stringify(metadata) : null]
    );

    return Response.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[POST /api/actions]', err);
    return Response.json({ error: 'Failed to create action' }, { status: 500 });
  }
}
