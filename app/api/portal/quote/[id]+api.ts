import { pool } from '@/lib/pool';

export async function GET(_req: Request, { id }: { id: string }) {
  try {
    const result = await pool.query(
      `SELECT id, title, "clientName", "organizationId", "orderType",
              "inHandsDate", "lineItemsData", calculations,
              "frontendStatus", status, "intakeSource", "notesClient",
              "quoteSentAt", "waveInvoiceLink", "createdAt"
       FROM "Project" WHERE id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    const p = result.rows[0];

    if (p.status === 'NEEDS_REVIEW' || p.status === 'DRAFT') {
      return Response.json({ error: 'Quote is not yet ready for viewing' }, { status: 403 });
    }

    const lineItems: any[] = (p.lineItemsData as any[]) || [];
    const calculations: any = p.calculations || null;

    const clientLineItems = lineItems.map((item: any) => ({
      id: item.id,
      designName: item.designName || '',
      serviceStyle: item.serviceStyle || '',
      location1: item.location1 || '',
      location2: item.location2 || '',
      location3: item.location3 || '',
      location4: item.location4 || '',
      locationDetails: item.locationDetails || '',
      sizes: item.sizes || {},
      garmentVariants: (item.garmentVariants || []).map((v: any) => ({
        product: v.product || '',
        color: v.color || '',
        sizes: v.sizes || {},
      })),
      subtotal: calculations
        ? null
        : null,
    }));

    const orgResult = p.organizationId
      ? await pool.query(`SELECT name FROM "Organization" WHERE id = $1`, [p.organizationId])
      : { rows: [] };

    return Response.json({
      id: p.id,
      projectName: p.title || '',
      clientName: p.clientName || orgResult.rows[0]?.name || '',
      orgName: orgResult.rows[0]?.name || p.clientName || '',
      orderType: p.orderType || 'New',
      inHandsDate: p.inHandsDate || '',
      notesClient: p.notesClient || '',
      quoteSentAt: p.quoteSentAt || null,
      waveInvoiceLink: p.waveInvoiceLink || null,
      status: p.frontendStatus || 'quoted',
      lineItems: clientLineItems,
      total: calculations?.total ?? null,
      totalPerPiece: calculations?.totalPerPiece ?? null,
      hasCalculations: !!calculations,
    });
  } catch (err) {
    console.error('[GET /api/portal/quote/:id]', err);
    return Response.json({ error: 'Failed to load quote' }, { status: 500 });
  }
}

export async function POST(request: Request, { id }: { id: string }) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'approve') {
      const result = await pool.query(
        `UPDATE "Project" SET "frontendStatus" = 'active', status = 'IN_PRODUCTION'::"ProjectStatus", "updatedAt" = NOW()
         WHERE id = $1 AND status NOT IN ('NEEDS_REVIEW', 'DRAFT') RETURNING id`,
        [id]
      );
      if (!result.rows[0]) return Response.json({ error: 'Not found or not approvable' }, { status: 404 });
      return Response.json({ ok: true, action: 'approved' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/portal/quote/:id]', err);
    return Response.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
