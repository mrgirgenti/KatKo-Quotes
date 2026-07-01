import { pool } from '@/lib/pool';
import { calculateLineItemSubtotal } from '@/utils/quoteCalculations';
import { resolveMockups } from '@/utils/mockupService';

const DEFAULT_UPCHARGES: Record<string, number> = { '2XL': 2, '3XL': 4, '4XL': 6, '5XL': 8, '6XL': 10 };

async function loadUpcharges(): Promise<Record<string, number>> {
  try {
    const r = await pool.query(
      `SELECT value FROM "AppSettings" WHERE key = $1`,
      ['product_pricing'],
    );
    const val = r.rows[0]?.value;
    if (val?.upcharges && typeof val.upcharges === 'object') {
      return val.upcharges as Record<string, number>;
    }
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_UPCHARGES;
}

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
        p."reorderedFromId",
        p."originalOrderDate",
        p."timesReordered",
        p."lastReorderedAt",
        p."quoteSentAt",
        p."quoteViewedAt",
        p."quoteResponse",
        p."quoteRespondedAt",
        p."quoteResponseBy",
        p."quoteResponseNote",
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

    // Customer-visible invoices for this project (never DRAFT). The project row
    // above already confirmed org ownership, so scoping by projectId is safe.
    const invoicesResult = await pool.query(
      `SELECT id, "invoiceNumber", status::text AS status, total, "amountPaid",
              "dueDate", "sentAt", "paymentUrl"
       FROM "Invoice"
       WHERE "projectId" = $1
         AND status::text <> 'DRAFT'
       ORDER BY "createdAt" DESC`,
      [projectId]
    );

    // ── Customer-safe sanitization ──────────────────────────────────────────
    // This is an UNAUTHENTICATED customer-facing endpoint. The raw Project JSON
    // (lineItemsData / calculations) carries internal financials — product /
    // service cost, markup amount & %, COGS, per-line fees — plus sourcing data
    // (apparelProvider, applicator). None of that may leave the server. We
    // whitelist only the keys the customer view renders.
    const { lineItemsData, calculations, ...rest } = result.rows[0] as any;

    // Load upcharges so 2XL/3XL/4XL size upcharges are included in the
    // customer-facing per-piece and line totals (falls back to defaults).
    const upcharges = await loadUpcharges();

    const safeLineItems = (Array.isArray(lineItemsData) ? lineItemsData : []).map((li: any) => {
      // Bundled customer price ONLY — computed server-side from the raw item. We
      // surface the per-piece and line totals the customer pays, never the cost /
      // markup / COGS breakdown those values are derived from.
      let customerUnitPrice = 0;
      let customerLineTotal = 0;
      try {
        const c = calculateLineItemSubtotal(li, upcharges);
        customerUnitPrice = c.perPiece;
        customerLineTotal = c.subtotal;
      } catch {
        /* unexpected shape — leave bundled price at 0 (renders as a dash) */
      }
      return {
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
        customerUnitPrice,
        customerLineTotal,
        garmentVariants: Array.isArray(li?.garmentVariants)
          ? li.garmentVariants.map((v: any) => ({
              product: v?.product ?? '',
              color: v?.color ?? '',
              sizes: v?.sizes ?? {},
            }))
          : [],
      };
    });

    const safeCalc = calculations
      ? {
          subtotal: calculations.subtotal ?? null,
          // Katalyst customer-facing fee terminology: separate Online Fee and
          // Card Fee rows (never a combined "Processing & Handling"). Rush Fee is
          // surfaced when present (future field). Only rows with values render.
          onlineFee: calculations.onlineFee ?? null,
          cardFee: calculations.cardFee ?? null,
          rushFee: calculations.rushFee ?? null,
          salesTax: calculations.salesTax ?? null,
          shipping: calculations.shipping ?? null,
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
      invoices: invoicesResult.rows,
      ...resolveMockups(safeLineItems),
    });
  } catch (err) {
    console.error('[GET /api/portal/[orgId]/projects/[projectId]]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
