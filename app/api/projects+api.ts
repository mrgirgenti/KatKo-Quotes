import { pool } from '@/lib/pool';
import type { Pool } from 'pg';
import type { Quote } from '@/types/quote';

async function resolveUserId(db: Pool, userId: unknown): Promise<string | null> {
  if (!userId || typeof userId !== 'string' || userId === 'default') return null;
  const check = await db.query(`SELECT id FROM "User" WHERE id = $1`, [userId]);
  return check.rows[0] ? userId : null;
}

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

export async function GET() {
  try {
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
    const result = await pool.query(
      `INSERT INTO "Project" (
        id, title, "clientName", "organizationId", "orderType", "orderDate", "inHandsDate",
        "invoiceNumber", "hasOnlineFee", "hasSalesTax", "hasCardFee",
        calculations, "salesData", "lineItemsData", "frontendStatus", status,
        "createdByUserId", "activeDate", "isLocked", "lockedDate",
        "exportedToSheets", "exportedToSheetsDate", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11::jsonb, $12::jsonb, $13::jsonb, $14, $15::"ProjectStatus",
        $16, $17, $18, $19, $20, $21, NOW(), NOW()
      ) RETURNING *`,
      [
        body.projectName || 'Untitled',
        body.personOrganization || '',
        body.orgId ?? null,
        body.orderType || 'New',
        body.orderDate || null,
        body.inHandsDate || null,
        body.invoiceNumber || null,
        body.hasOnlineFee ?? true,
        body.hasSalesTax ?? false,
        body.hasCardFee ?? true,
        JSON.stringify(body.calculations ?? null),
        JSON.stringify(body.salesData ?? null),
        JSON.stringify(body.lineItems ?? []),
        body.status || 'quoted',
        frontendStatusToDbStatus(body.status || 'quoted'),
        await resolveUserId(pool, (body as any).userId), // createdByUserId: verified FK
        (body as any).activeDate ?? null,
        (body as any).isLocked ?? false,
        (body as any).lockedDate ?? null,
        (body as any).exportedToSheets ?? false,
        (body as any).exportedToSheetsDate ?? null,
      ],
    );
    return Response.json(toFrontendQuote(result.rows[0]), { status: 201 });
  } catch (err) {
    console.error('[POST /api/projects]', err);
    return Response.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
