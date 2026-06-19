import { pool } from '@/lib/pool';
import type { Quote, ProjectPriority } from '@/types/quote';
import { authenticateRequest, unauthorized, forbidden } from '@/lib/auth';

function dbPriorityToFrontend(p: string | null | undefined): ProjectPriority {
  switch (p) {
    case 'CRITICAL': return 'Critical';
    case 'HIGH': return 'High';
    case 'RUSH': return 'High';
    case 'LOW': return 'Low';
    case 'NORMAL':
    default: return 'Normal';
  }
}

function frontendPriorityToDb(p: string | null | undefined): string {
  switch (p) {
    case 'Critical': return 'CRITICAL';
    case 'High': return 'HIGH';
    case 'Low': return 'LOW';
    case 'Normal':
    default: return 'NORMAL';
  }
}

const VALID_STATUSES = new Set(['draft','needs_review','quoting','quoted','invoice_sent','paid','active','production_started','completed','expired']);

function toFrontendQuote(p: any): Quote {
  let status = (p.frontendStatus || 'quoted') as Quote['status'];
  if (p.status === 'NEEDS_REVIEW') status = 'needs_review';
  if (p.status === 'QUOTING') status = 'quoting';
  if (p.status === 'PAID') status = 'paid';
  if (p.status === 'INVOICE_SENT') status = 'invoice_sent';
  if ((status as string) === 'quote_approved') status = 'quoted';
  if (!VALID_STATUSES.has(status as string)) status = 'quoted';
  return {
    id: p.id,
    orgId: p.organizationId ?? undefined,
    intakeSource: p.intakeSource ?? undefined,
    personOrganization: p.clientName || '',
    projectName: p.title || '',
    orderType: (p.orderType || 'New') as Quote['orderType'],
    orderDate: p.orderDate || '',
    inHandsDate: p.inHandsDate || '',
    invoiceNumber: p.invoiceNumber || '',
    lineItems: (p.lineItemsData as Quote['lineItems'] | null) || [],
    hasOnlineFee: p.hasOnlineFee ?? true,
    hasSalesTax: p.hasSalesTax ?? false,
    hasCardFee: p.hasCardFee ?? true,
    calculations: (p.calculations as Quote['calculations'] | null) || null,
    salesData: (p.salesData as Quote['salesData'] | null) || undefined,
    createdAt: new Date(p.createdAt).toISOString(),
    status,
    userId: p.createdByUserId ?? undefined,
    activeDate: p.activeDate ?? undefined,
    isLocked: p.isLocked ?? false,
    lockedDate: p.lockedDate ?? undefined,
    exportedToSheets: p.exportedToSheets ?? false,
    exportedToSheetsDate: p.exportedToSheetsDate ?? undefined,
    quoteSentAt: p.quoteSentAt ?? undefined,
    notesClient: p.notesClient ?? undefined,
    waveInvoiceLink: p.waveInvoiceLink ?? undefined,
    projectNumber: p.projectNumber ?? undefined,
    operationalStatus: p.operationalStatus ?? null,
    holdReason: p.holdReason ?? null,
    holdNotes: p.holdNotes ?? null,
    holdPlacedAt: p.holdPlacedAt ?? null,
    holdPlacedBy: p.holdPlacedBy ?? null,
    deliveryMethod: p.deliveryMethod ?? null,
    paymentReceived: p.paymentReceived ?? false,
    artworkReceived: p.artworkReceived ?? false,
    proofApproved: p.proofApproved ?? false,
    priority: dbPriorityToFrontend(p.priority),
    assignedToUserId: p.assignedToUserId ?? null,
    rush: p.rush ?? false,
  } as Quote;
}

const PAID_OR_LATER = new Set(['paid', 'active', 'production_started', 'completed']);

function frontendStatusToDbStatus(s: string) {
  switch (s) {
    case 'draft': return 'DRAFT';
    case 'needs_review': return 'NEEDS_REVIEW';
    case 'quoting': return 'QUOTING';
    case 'quoted': return 'QUOTE_SENT';
    case 'invoice_sent': return 'INVOICE_SENT';
    case 'paid': return 'PAID';
    case 'active': return 'IN_PRODUCTION';
    case 'production_started': return 'IN_PRODUCTION';
    case 'completed': return 'COMPLETED';
    case 'expired': return 'CANCELLED';
    default: return 'DRAFT';
  }
}

function sumSizes(sizes: Record<string, number>): number {
  return Object.values(sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

async function upsertProjectItems(projectId: string, lineItems: any[]): Promise<void> {
  await pool.query(`DELETE FROM "ProjectItem" WHERE "projectId" = $1`, [projectId]);
  for (const item of lineItems) {
    const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean);
    const qty = item.garmentVariants?.length
      ? item.garmentVariants.reduce((s: number, v: any) => s + sumSizes(v.sizes || {}), 0)
      : sumSizes(item.sizes || {});
    await pool.query(
      `INSERT INTO "ProjectItem" (
        id, "projectId", "itemName", "productCategory",
        vendor, "catalogStyle", color, "printMethod", quantity,
        "sizeBreakdown", "printLocations", "artworkNotes", "rawLineItemData",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9::jsonb, $10::jsonb, $11, $12::jsonb,
        NOW(), NOW()
      )`,
      [
        projectId,
        item.designName || 'Untitled',
        item.serviceStyle || null,
        item.apparelProvider || null,
        item.product || null,
        item.productColor || null,
        item.serviceStyle || null,
        Math.max(qty, 0),
        JSON.stringify(item.sizes || {}),
        JSON.stringify(locations),
        item.locationDetails || null,
        JSON.stringify(item),
      ],
    );
  }
}

export async function GET(_req: Request, { id }: { id: string }) {
  try {
    const result = await pool.query(`SELECT * FROM "Project" WHERE id = $1`, [id]);
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(toFrontendQuote(result.rows[0]));
  } catch (err) {
    return Response.json({ error: 'Failed to load project' }, { status: 500 });
  }
}

const STATUS_TO_ACTIVITY: Record<string, string> = {
  quoted:             'quote_sent',
  quote_approved:     'quote_approved',
  invoice_sent:       'invoice_sent',
  paid:               'payment_received',
  active:             'in_production',
  production_started: 'in_production',
  completed:          'completed',
};

export async function PUT(request: Request, { id }: { id: string }) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();

    const body: Quote = await request.json();

    const prevResult = await pool.query(
      `SELECT "frontendStatus", "organizationId", title,
              "operationalStatus", "holdReason", "holdNotes", "holdPlacedAt", "holdPlacedBy",
              "deliveryMethod", "paymentReceived", "artworkReceived", "proofApproved",
              priority, "assignedToUserId", rush
       FROM "Project" WHERE id = $1`,
      [id],
    );
    const prev = prevResult.rows[0];
    const b = body as any;

    // Role enforcement: priority + assignee changes require org_admin.
    const incomingPriority = b.priority !== undefined ? frontendPriorityToDb(b.priority) : undefined;
    const priorityChanging = incomingPriority !== undefined && incomingPriority !== (prev?.priority ?? 'NORMAL');
    const assigneeChanging = b.assignedToUserId !== undefined && b.assignedToUserId !== (prev?.assignedToUserId ?? null);
    if ((priorityChanging || assigneeChanging) && authedUser.role !== 'org_admin') {
      return forbidden('Only org admins can change project priority or assignee');
    }

    // Operational fields are preserved when the caller omits them (undefined),
    // so generic project saves never wipe operational state.
    const keep = <T>(incoming: T | undefined, existing: T): T =>
      incoming === undefined ? existing : incoming;

    const operationalStatus = keep(b.operationalStatus, prev?.operationalStatus ?? null);
    const holdReason = keep(b.holdReason, prev?.holdReason ?? null);
    const holdNotes = keep(b.holdNotes, prev?.holdNotes ?? null);
    const holdPlacedAt = keep(b.holdPlacedAt, prev?.holdPlacedAt ?? null);
    const holdPlacedBy = keep(b.holdPlacedBy, prev?.holdPlacedBy ?? null);
    const deliveryMethod = keep(b.deliveryMethod, prev?.deliveryMethod ?? null);
    // Payment auto-sets true once the project reaches a paid-or-later sales status.
    // Use the effective status (incoming if present, otherwise the existing one) so
    // partial saves that omit status still upgrade an already paid-or-later project.
    const effectiveStatus = body.status ?? prev?.frontendStatus;
    const paymentReceived = keep(b.paymentReceived, prev?.paymentReceived ?? false) || PAID_OR_LATER.has(effectiveStatus);
    const artworkReceived = keep(b.artworkReceived, prev?.artworkReceived ?? false);
    const proofApproved = keep(b.proofApproved, prev?.proofApproved ?? false);

    // Priority: stored as a DB enum; preserve existing enum when caller omits it,
    // otherwise translate the frontend label into the enum value.
    const priority = b.priority === undefined
      ? (prev?.priority ?? 'NORMAL')
      : frontendPriorityToDb(b.priority);

    const rush = keep(b.rush, prev?.rush ?? false);

    // Assignee FK must reference an existing User (or be null). Validate to avoid
    // FK-violation 500s when a stale id is sent.
    let assignedToUserId: string | null = keep(b.assignedToUserId, prev?.assignedToUserId ?? null);
    if (assignedToUserId) {
      const chk = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [assignedToUserId]);
      if (!chk.rows[0]) assignedToUserId = null;
    }

    const result = await pool.query(
      `UPDATE "Project" SET
        title = $1, "clientName" = $2, "organizationId" = $3, "orderType" = $4,
        "orderDate" = $5, "inHandsDate" = $6, "invoiceNumber" = $7,
        "hasOnlineFee" = $8, "hasSalesTax" = $9, "hasCardFee" = $10,
        calculations = $11::jsonb, "salesData" = $12::jsonb, "lineItemsData" = $13::jsonb,
        "frontendStatus" = $14, status = $15::"ProjectStatus",
        "activeDate" = $16, "isLocked" = $17, "lockedDate" = $18,
        "exportedToSheets" = $19, "exportedToSheetsDate" = $20,
        "quoteSentAt" = $21, "waveInvoiceLink" = $22,
        "operationalStatus" = $24, "holdReason" = $25, "holdNotes" = $26,
        "holdPlacedAt" = $27, "holdPlacedBy" = $28, "deliveryMethod" = $29,
        "paymentReceived" = $30, "artworkReceived" = $31, "proofApproved" = $32,
        priority = $33::"PriorityLevel", "assignedToUserId" = $34, rush = $35,
        "updatedAt" = NOW()
      WHERE id = $23 RETURNING *`,
      [
        body.projectName || 'Untitled',
        body.personOrganization || '',
        body.orgId ?? null,
        body.orderType,
        body.orderDate || null,
        body.inHandsDate || null,
        body.invoiceNumber || null,
        body.hasOnlineFee,
        body.hasSalesTax,
        body.hasCardFee,
        JSON.stringify(body.calculations ?? null),
        JSON.stringify(body.salesData ?? null),
        JSON.stringify(body.lineItems ?? []),
        body.status,
        frontendStatusToDbStatus(body.status),
        (body as any).activeDate ?? null,
        (body as any).isLocked ?? false,
        (body as any).lockedDate ?? null,
        (body as any).exportedToSheets ?? false,
        (body as any).exportedToSheetsDate ?? null,
        (body as any).quoteSentAt ?? null,
        (body as any).waveInvoiceLink ?? null,
        id,
        operationalStatus,
        holdReason,
        holdNotes,
        holdPlacedAt,
        holdPlacedBy,
        deliveryMethod,
        paymentReceived,
        artworkReceived,
        proofApproved,
        priority,
        assignedToUserId,
        rush,
      ],
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });

    const updated = result.rows[0];
    const newStatus = updated.frontendStatus as string;
    const oldStatus = prev?.frontendStatus as string | undefined;
    const orgId = updated.organizationId as string | null;

    // Operational status transition logging (independent of orgId — keyed on projectId).
    const prevOperational = (prev?.operationalStatus ?? null) as string | null;
    if (operationalStatus && operationalStatus !== prevOperational) {
      const actorName = authedUser.name || (b.actorName as string | undefined) || 'Someone';
      const isHold = operationalStatus === 'On Hold';
      const summary = isHold
        ? `${actorName} placed "${updated.title || 'Untitled'}" On Hold${holdReason ? ` (${holdReason})` : ''}`
        : `${actorName} set status to ${operationalStatus}${prevOperational ? ` (from ${prevOperational})` : ''}`;
      pool.query(
        `INSERT INTO "ActivityLog" (id, "organizationId", "projectId", "actionType", "actionSummary", metadata, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, NOW())`,
        [
          orgId,
          id,
          isHold ? 'operational_on_hold' : 'operational_status_change',
          summary,
          JSON.stringify({
            projectName: updated.title,
            fromStatus: prevOperational,
            toStatus: operationalStatus,
            holdReason: holdReason ?? null,
            holdNotes: holdNotes ?? null,
            actorName,
          }),
        ],
      ).catch((err) => console.error('[PUT /api/projects/:id] operational ActivityLog insert failed:', err));
    }

    if (orgId && newStatus && oldStatus && newStatus !== oldStatus) {
      const activityType = STATUS_TO_ACTIVITY[newStatus];
      if (activityType) {
        const labels: Record<string, string> = {
          quote_sent:       `Quote sent to client: ${updated.title || 'Untitled'}`,
          quote_approved:   `Quote approved by client: ${updated.title || 'Untitled'}`,
          invoice_sent:     `Invoice sent: ${updated.title || 'Untitled'}`,
          payment_received: `Payment received for: ${updated.title || 'Untitled'}`,
          in_production:    `Order moved to production: ${updated.title || 'Untitled'}`,
          completed:        `Order completed: ${updated.title || 'Untitled'}`,
        };
        pool.query(
          `INSERT INTO "ActivityLog" (id, "organizationId", "projectId", "actionType", "actionSummary", metadata, "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, NOW())`,
          [
            orgId,
            id,
            activityType,
            labels[activityType] || `Status updated: ${newStatus}`,
            JSON.stringify({ projectName: updated.title, fromStatus: oldStatus, toStatus: newStatus }),
          ],
        ).catch((err) => console.error('[PUT /api/projects/:id] ActivityLog insert failed:', err));
      }
    }

    if (body.lineItems?.length) {
      await upsertProjectItems(id, body.lineItems).catch((err) =>
        console.error('[PUT /api/projects/:id] ProjectItem upsert failed (non-fatal):', err),
      );
    }

    return Response.json(toFrontendQuote(updated));
  } catch (err) {
    console.error('[PUT /api/projects/:id]', err);
    return Response.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { id }: { id: string }) {
  try {
    const authedUser = await authenticateRequest(request);
    if (!authedUser) return unauthorized();
    if (authedUser.role !== 'org_admin') return forbidden('Only org admins can delete projects');

    await pool.query(`DELETE FROM "Project" WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
