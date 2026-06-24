import { pool } from '@/lib/pool';
import {
  sendEmail,
  buildQuoteApprovedNotificationEmail,
  buildQuoteChangesRequestedAdminEmail,
  buildQuoteDeclinedAdminEmail,
  buildQuoteResponseCustomerEmail,
} from '@/lib/email';

const KO_JOBS_EMAIL = 'jobs@katalystko.com';
type Action = 'view' | 'approve' | 'request_changes' | 'decline';
const RESPONSE_ACTIONS: Action[] = ['approve', 'request_changes', 'decline'];

function clientIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim() || null;
  return request.headers.get('x-real-ip') || null;
}

// Customer responds to a quote from the Client Hub.
// Body: { userId, action: 'view'|'approve'|'request_changes'|'decline', note? }
export async function POST(
  request: Request,
  params: { orgId: string; projectId: string }
) {
  try {
    const { orgId, projectId } = params ?? {};
    if (!orgId || !projectId) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const userId: string | undefined = body.userId;
    const action: Action | undefined = body.action;
    const note: string = (body.note ?? '').toString().trim();

    if (!userId || !action) {
      return Response.json({ error: 'userId and action are required' }, { status: 400 });
    }
    if (!(['view', ...RESPONSE_ACTIONS] as string[]).includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Org must exist and have the hub enabled.
    const orgRes = await pool.query(
      `SELECT id, name, "hubEnabled" FROM "Organization" WHERE id = $1`,
      [orgId]
    );
    const org = orgRes.rows[0];
    if (!org || !org.hubEnabled) {
      return Response.json({ error: 'Hub not found or not enabled' }, { status: 403 });
    }

    // Membership + permission lookup. Only CLIENT members of this org.
    const memRes = await pool.query(
      `SELECT u.id, u."firstName", u."lastName", u.email,
              om."canApproveQuotes", om."isPrimaryContact", om.role
       FROM "OrganizationMembership" om
       JOIN "User" u ON u.id = om."userId"
       WHERE om."organizationId" = $1 AND u.id = $2 AND u."userType" = 'CLIENT'`,
      [orgId, userId]
    );
    const member = memRes.rows[0];
    if (!member) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const responderName =
      `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email || 'Client';
    const responderEmail: string | null = member.email || null;

    // ── View tracking (membership only, idempotent, no notification) ──────────
    if (action === 'view') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const upd = await client.query(
          `UPDATE "Project"
             SET "quoteViewedAt" = NOW()
           WHERE id = $1 AND "organizationId" = $2
             AND status = 'QUOTE_SENT'::"ProjectStatus"
             AND "quoteViewedAt" IS NULL
           RETURNING id, title`,
          [projectId, orgId]
        );
        if (upd.rows[0]) {
          await client.query(
            `INSERT INTO "ActivityLog" (
              id, "organizationId", "projectId", "userId",
              "actionType", "actionSummary", metadata, "createdAt"
            ) VALUES (gen_random_uuid(), $1, $2, $3, 'client_quote_viewed', $4, $5::jsonb, NOW())`,
            [
              orgId,
              projectId,
              userId,
              `${responderName} viewed the quote — "${upd.rows[0].title || 'Untitled'}"`,
              JSON.stringify({ source: 'CLIENT_HUB', responderName, ip: clientIp(request) }),
            ]
          );
        }
        await client.query('COMMIT');
        return Response.json({ ok: true, viewed: !!upd.rows[0] });
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }
    }

    // ── Approve / Request Changes / Decline ───────────────────────────────────
    // All members may request changes or decline a quote.
    // Only primary contacts or members with canApproveQuotes may approve.
    if (action === 'approve' && !member.canApproveQuotes && !member.isPrimaryContact && member.role !== 'ORG_ADMIN') {
      return Response.json(
        { error: 'Only the primary contact, org admin, or an authorized member can approve quotes.' },
        { status: 403 }
      );
    }

    if (action === 'request_changes' && !note) {
      return Response.json({ error: 'Please describe the changes you would like.' }, { status: 400 });
    }

    const ip = clientIp(request);
    let updated: any;
    let projectName = 'Untitled';
    let total: number | null = null;

    // Persist the response and its audit-log entry atomically: a quote can never
    // be marked responded-to without a matching audit trail (or vice versa).
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (action === 'approve') {
        const r = await client.query(
          `UPDATE "Project" SET
              "quoteResponse" = 'approved',
              "quoteRespondedAt" = NOW(),
              "quoteResponseBy" = $3,
              "quoteResponseByUserId" = $4,
              "quoteResponseIp" = $5,
              "updatedAt" = NOW()
           WHERE id = $1 AND "organizationId" = $2
             AND status = 'QUOTE_SENT'::"ProjectStatus"
             AND "quoteResponse" IS NULL
           RETURNING *`,
          [projectId, orgId, responderName, userId, ip]
        );
        updated = r.rows[0];
      } else if (action === 'request_changes') {
        const r = await client.query(
          `UPDATE "Project" SET
              "quoteResponse" = 'changes_requested',
              "quoteRespondedAt" = NOW(),
              "quoteResponseBy" = $3,
              "quoteResponseByUserId" = $4,
              "quoteResponseIp" = $5,
              "quoteResponseNote" = $6,
              status = 'QUOTING'::"ProjectStatus",
              "frontendStatus" = 'quoting',
              "updatedAt" = NOW()
           WHERE id = $1 AND "organizationId" = $2
             AND status = 'QUOTE_SENT'::"ProjectStatus"
             AND "quoteResponse" IS NULL
           RETURNING *`,
          [projectId, orgId, responderName, userId, ip, note]
        );
        updated = r.rows[0];
      } else {
        // decline — keep the Prisma status so the project stays visible in the hub.
        const r = await client.query(
          `UPDATE "Project" SET
              "quoteResponse" = 'declined',
              "quoteRespondedAt" = NOW(),
              "quoteResponseBy" = $3,
              "quoteResponseByUserId" = $4,
              "quoteResponseIp" = $5,
              "quoteResponseNote" = $6,
              "updatedAt" = NOW()
           WHERE id = $1 AND "organizationId" = $2
             AND status = 'QUOTE_SENT'::"ProjectStatus"
             AND "quoteResponse" IS NULL
           RETURNING *`,
          [projectId, orgId, responderName, userId, ip, note || null]
        );
        updated = r.rows[0];
      }

      // No row updated → quote not in a respondable state or already responded to.
      if (!updated) {
        await client.query('ROLLBACK');
        return Response.json(
          { error: 'This quote is no longer awaiting a response.' },
          { status: 409 }
        );
      }

      projectName = updated.title || 'Untitled';
      total =
        updated.calculations && updated.calculations.total != null
          ? Number(updated.calculations.total)
          : null;

      // Audit / timeline entry — committed atomically with the response above.
      const actionMeta: Record<string, string> = {
        approve: 'client_quote_approved',
        request_changes: 'client_quote_changes_requested',
        decline: 'client_quote_declined',
      };
      const summaryMap: Record<string, string> = {
        approve: `${responderName} approved the quote — "${projectName}"`,
        request_changes: `${responderName} requested changes — "${projectName}"`,
        decline: `${responderName} declined the quote — "${projectName}"`,
      };
      await client.query(
        `INSERT INTO "ActivityLog" (
          id, "organizationId", "projectId", "userId",
          "actionType", "actionSummary", metadata, "createdAt"
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, NOW())`,
        [
          orgId,
          projectId,
          userId,
          actionMeta[action],
          summaryMap[action],
          JSON.stringify({
            source: 'CLIENT_HUB',
            responderName,
            responderEmail,
            ip,
            total,
            note: note || null,
          }),
        ]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    // Notifications (non-blocking). Build absolute URLs (with scheme) so the email
    // CTA links resolve correctly in mail clients — a bare host is treated relative.
    const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    const adminUrl = `${baseUrl}/quote/${projectId}`;
    const portalUrl = `${baseUrl}/portal/${orgId}?tab=projects`;
    const customerAction =
      action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : 'changes_requested';

    try {
      // Internal notification.
      let adminMail;
      if (action === 'approve') {
        adminMail = buildQuoteApprovedNotificationEmail({
          projectName, orgName: org.name, submittedBy: responderName, total, adminUrl,
        });
      } else if (action === 'request_changes') {
        adminMail = buildQuoteChangesRequestedAdminEmail({
          projectName, orgName: org.name, requestedBy: responderName, comments: note, adminUrl,
        });
      } else {
        adminMail = buildQuoteDeclinedAdminEmail({
          projectName, orgName: org.name, declinedBy: responderName, reason: note, adminUrl,
        });
      }
      const aRes = await sendEmail({ to: KO_JOBS_EMAIL, subject: adminMail.subject, html: adminMail.html, text: adminMail.text });
      if (aRes.error) console.error('[quote-response] admin email failed:', aRes.error);
    } catch (e) {
      console.error('[quote-response] admin email error (non-fatal):', e);
    }

    try {
      // Customer confirmation.
      if (responderEmail) {
        const cMail = buildQuoteResponseCustomerEmail({
          clientName: member.firstName || responderName,
          projectName,
          orgName: org.name,
          action: customerAction,
          note: note || undefined,
          portalUrl,
        });
        const cRes = await sendEmail({ to: responderEmail, subject: cMail.subject, html: cMail.html, text: cMail.text });
        if (cRes.error) console.error('[quote-response] customer email failed:', cRes.error);
      }
    } catch (e) {
      console.error('[quote-response] customer email error (non-fatal):', e);
    }

    return Response.json({
      ok: true,
      quoteResponse: updated.quoteResponse,
      quoteRespondedAt: updated.quoteRespondedAt,
      quoteResponseBy: updated.quoteResponseBy,
      quoteResponseNote: updated.quoteResponseNote,
      status: action === 'request_changes' ? 'QUOTING' : 'QUOTED',
    });
  } catch (err) {
    console.error('[POST /api/portal/[orgId]/projects/[projectId]/quote-response]', err);
    return Response.json({ error: 'Failed to record quote response' }, { status: 500 });
  }
}
