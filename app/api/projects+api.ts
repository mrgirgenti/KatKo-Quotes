import { pool } from '@/lib/pool';
import type { Pool } from 'pg';
import type { Quote, ProjectPriority } from '@/types/quote';

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

async function resolveUserId(db: Pool, userId: unknown): Promise<string | null> {
  if (!userId || typeof userId !== 'string' || userId === 'default') return null;
  const check = await db.query(`SELECT id FROM "User" WHERE id = $1`, [userId]);
  return check.rows[0] ? userId : null;
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
    projectNumber: p.projectNumber ?? undefined,
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

async function generateProjectNumber(db: Pool): Promise<string> {
  const result = await db.query(
    `SELECT "projectNumber" FROM "Project" WHERE "projectNumber" IS NOT NULL ORDER BY "projectNumber" DESC LIMIT 1`
  );
  let next = 1001;
  if (result.rows.length > 0) {
    const last = result.rows[0].projectNumber as string;
    const num = parseInt(last.replace('P-', ''), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `P-${next}`;
}

let backfillRan = false;
async function runBackfillOnce(db: Pool): Promise<void> {
  if (backfillRan) return;
  backfillRan = true;
  try {
    const nullRows = await db.query(
      `SELECT id FROM "Project" WHERE "projectNumber" IS NULL ORDER BY "createdAt" ASC`
    );
    if (nullRows.rows.length === 0) return;

    const maxRow = await db.query(
      `SELECT "projectNumber" FROM "Project" WHERE "projectNumber" IS NOT NULL ORDER BY "projectNumber" DESC LIMIT 1`
    );
    let next = 1001;
    if (maxRow.rows.length > 0) {
      const last = maxRow.rows[0].projectNumber as string;
      const num = parseInt(last.replace('P-', ''), 10);
      if (!isNaN(num)) next = num + 1;
    }

    for (const row of nullRows.rows) {
      await db.query(
        `UPDATE "Project" SET "projectNumber" = $1 WHERE id = $2 AND "projectNumber" IS NULL`,
        [`P-${next}`, row.id]
      );
      next++;
    }
    console.log(`[backfill] Assigned project numbers to ${nullRows.rows.length} projects`);
  } catch (err) {
    console.error('[backfill] Failed to backfill project numbers:', err);
    backfillRan = false;
  }
}

export async function GET() {
  try {
    runBackfillOnce(pool).catch(() => {});
    const result = await pool.query(`SELECT * FROM "Project" ORDER BY "createdAt" DESC`);
    return Response.json(result.rows.map(toFrontendQuote));
  } catch (err) {
    console.error('[GET /api/projects]', err);
    return Response.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: Quote = await request.json();
    const projectNumber = await generateProjectNumber(pool);

    const result = await pool.query(
      `INSERT INTO "Project" (
        id, title, "clientName", "organizationId", "orderType", "orderDate", "inHandsDate",
        "invoiceNumber", "projectNumber", "hasOnlineFee", "hasSalesTax", "hasCardFee",
        calculations, "salesData", "lineItemsData", "frontendStatus", status,
        "createdByUserId", "activeDate", "isLocked", "lockedDate",
        "exportedToSheets", "exportedToSheetsDate", priority, "assignedToUserId", rush,
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12::jsonb, $13::jsonb, $14::jsonb, $15, $16::"ProjectStatus",
        $17, $18, $19, $20, $21, $22, $23::"PriorityLevel", $24, $25, NOW(), NOW()
      ) RETURNING *`,
      [
        body.projectName || 'Untitled',
        body.personOrganization || '',
        body.orgId ?? null,
        body.orderType || 'New',
        // Order Date rule: respect a user-provided value; otherwise auto-populate
        // today's date so no quote is ever created without an Order Date.
        (typeof body.orderDate === 'string' && body.orderDate.trim())
          ? body.orderDate.trim()
          : new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        body.inHandsDate || null,
        body.invoiceNumber || null,
        projectNumber,
        body.hasOnlineFee ?? true,
        body.hasSalesTax ?? false,
        body.hasCardFee ?? true,
        JSON.stringify(body.calculations ?? null),
        JSON.stringify(body.salesData ?? null),
        JSON.stringify(body.lineItems ?? []),
        body.status || 'quoted',
        frontendStatusToDbStatus(body.status || 'quoted'),
        await resolveUserId(pool, (body as any).userId),
        (body as any).activeDate ?? null,
        (body as any).isLocked ?? false,
        (body as any).lockedDate ?? null,
        (body as any).exportedToSheets ?? false,
        (body as any).exportedToSheetsDate ?? null,
        frontendPriorityToDb((body as any).priority),
        (body as any).assignedToUserId ?? null,
        (body as any).rush ?? false,
      ],
    );
    const created = result.rows[0];

    if (created.organizationId) {
      pool.query(
        `INSERT INTO "ActivityLog" (id, "organizationId", "projectId", "actionType", "actionSummary", metadata, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, 'quote_created', $3, $4::jsonb, NOW())`,
        [
          created.organizationId,
          created.id,
          `Quote created: ${created.title || 'Untitled'}`,
          JSON.stringify({ projectName: created.title, projectId: created.id }),
        ],
      ).catch((err) => console.error('[POST /api/projects] ActivityLog insert failed:', err));
    }

    return Response.json(toFrontendQuote(created), { status: 201 });
  } catch (err) {
    console.error('[POST /api/projects]', err);
    return Response.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
