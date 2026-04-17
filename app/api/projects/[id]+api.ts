import { pool } from '@/lib/pool';
import type { Quote } from '@/types/quote';

function toFrontendQuote(p: any): Quote {
  return {
    id: p.id,
    orgId: p.organizationId ?? undefined,
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
    status: (p.frontendStatus || 'quoted') as Quote['status'],
    userId: p.createdByUserId ?? undefined,
    activeDate: p.activeDate ?? undefined,
    isLocked: p.isLocked ?? false,
    lockedDate: p.lockedDate ?? undefined,
    exportedToSheets: p.exportedToSheets ?? false,
    exportedToSheetsDate: p.exportedToSheetsDate ?? undefined,
  } as Quote;
}

function frontendStatusToDbStatus(s: string) {
  switch (s) {
    case 'draft': return 'DRAFT';
    case 'quoted': return 'QUOTE_SENT';
    case 'active': return 'IN_PRODUCTION';
    case 'production_started': return 'IN_PRODUCTION';
    case 'completed': return 'COMPLETED';
    case 'expired': return 'CANCELLED';
    default: return 'DRAFT';
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

export async function PUT(request: Request, { id }: { id: string }) {
  try {
    const body: Quote = await request.json();
    const result = await pool.query(
      `UPDATE "Project" SET
        title = $1, "clientName" = $2, "organizationId" = $3, "orderType" = $4,
        "orderDate" = $5, "inHandsDate" = $6, "invoiceNumber" = $7,
        "hasOnlineFee" = $8, "hasSalesTax" = $9, "hasCardFee" = $10,
        calculations = $11::jsonb, "salesData" = $12::jsonb, "lineItemsData" = $13::jsonb,
        "frontendStatus" = $14, status = $15::"ProjectStatus",
        "activeDate" = $16, "isLocked" = $17, "lockedDate" = $18,
        "exportedToSheets" = $19, "exportedToSheetsDate" = $20,
        "updatedAt" = NOW()
      WHERE id = $21 RETURNING *`,
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
        id,
      ],
    );
    return Response.json(toFrontendQuote(result.rows[0]));
  } catch (err) {
    console.error('[PUT /api/projects/:id]', err);
    return Response.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { id }: { id: string }) {
  try {
    await pool.query(`DELETE FROM "Project" WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
