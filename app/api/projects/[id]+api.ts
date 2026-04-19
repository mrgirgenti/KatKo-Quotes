import { pool } from '@/lib/pool';
import type { Quote } from '@/types/quote';

function toFrontendQuote(p: any): Quote {
  let status = (p.frontendStatus || 'quoted') as Quote['status'];
  if (p.status === 'NEEDS_REVIEW') status = 'needs_review';
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
  } as Quote;
}

function frontendStatusToDbStatus(s: string) {
  switch (s) {
    case 'draft': return 'DRAFT';
    case 'needs_review': return 'NEEDS_REVIEW';
    case 'quoted': return 'QUOTE_SENT';
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
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });

    if (body.lineItems?.length) {
      await upsertProjectItems(id, body.lineItems).catch((err) =>
        console.error('[PUT /api/projects/:id] ProjectItem upsert failed (non-fatal):', err),
      );
    }

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
