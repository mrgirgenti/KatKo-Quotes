import { pool } from '@/lib/pool';

export async function GET(
  _req: Request,
  { orgId, projectId }: { orgId: string; projectId: string }
) {
  try {
    const orgResult = await pool.query(
      `SELECT id, "hubEnabled" FROM "Organization" WHERE id = $1`,
      [orgId]
    );
    if (!orgResult.rows[0] || !orgResult.rows[0].hubEnabled) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await pool.query(
      `SELECT
        p.id,
        p.title,
        p."orderType",
        p."orderDate",
        p."inHandsDate",
        p."notesClient",
        p."lineItemsData",
        p."calculations",
        p."hasOnlineFee",
        p."hasSalesTax",
        p."hasCardFee",
        CASE p.status::text
          WHEN 'QUOTE_SENT' THEN 'QUOTED'
          WHEN 'DRAFT'      THEN 'NEEDS_REVIEW'
          ELSE p.status::text
        END AS status,
        p."createdAt"
      FROM "Project" p
      WHERE p."organizationId" = $1
        AND p.id = $2
        AND p.status != 'CANCELLED'::"ProjectStatus"`,
      [orgId, projectId]
    );

    if (!result.rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // Customer-visible project files only (never internal artwork/proofs)
    const filesResult = await pool.query(
      `SELECT id, "originalName", "mimeType", "fileSize", "fileType", "createdAt"
       FROM "File"
       WHERE "projectId" = $1
         AND "organizationId" = $2
         AND "visibility" = 'CLIENT_VISIBLE'
       ORDER BY "createdAt" DESC`,
      [projectId, orgId]
    );

    // ── Customer-safe sanitization ──────────────────────────────────────────
    // This is an UNAUTHENTICATED customer-facing endpoint. The raw Project JSON
    // (lineItemsData / calculations) carries internal financials — product /
    // service cost, markup amount & %, COGS, per-line fees — plus sourcing data
    // (apparelProvider, applicator). None of that may leave the server. We
    // whitelist only the keys the customer view renders.
    const { lineItemsData, calculations, ...rest } = result.rows[0] as any;

    const safeLineItems = (Array.isArray(lineItemsData) ? lineItemsData : []).map((li: any) => ({
      id: li?.id,
      designName: li?.designName ?? '',
      serviceStyle: li?.serviceStyle ?? '',
      location1: li?.location1 ?? '',
      location2: li?.location2 ?? '',
      location3: li?.location3 ?? '',
      location4: li?.location4 ?? '',
      locationDetails: li?.locationDetails ?? '',
      product: li?.product ?? '',
      productColor: li?.productColor ?? '',
      mockupUri: li?.mockupUri ?? '',
      sizes: li?.sizes ?? {},
      garmentVariants: Array.isArray(li?.garmentVariants)
        ? li.garmentVariants.map((v: any) => ({
            product: v?.product ?? '',
            color: v?.color ?? '',
            sizes: v?.sizes ?? {},
          }))
        : [],
    }));

    const safeCalc = calculations
      ? {
          subtotal: calculations.subtotal ?? null,
          salesTax: calculations.salesTax ?? null,
          shipping: calculations.shipping ?? null,
          // Customer-paid card/online fees are surfaced as a single combined
          // "Processing & Handling" amount — never as a fee-rate breakdown.
          processingFee:
            (Number(calculations.onlineFee) || 0) + (Number(calculations.cardFee) || 0) || null,
          total: calculations.total ?? null,
          totalPerPiece: calculations.totalPerPiece ?? null,
          totalQuantity: calculations.totalQuantity ?? null,
        }
      : null;

    return Response.json({
      ...rest,
      lineItemsData: safeLineItems,
      calculations: safeCalc,
      files: filesResult.rows,
    });
  } catch (err) {
    console.error('[GET /api/portal/[orgId]/projects/[projectId]]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
