import { pool } from '@/lib/pool';

export async function GET(_req: Request, { orgId }: { orgId: string }) {
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
        CASE p.status::text
          WHEN 'QUOTE_SENT' THEN 'QUOTED'
          WHEN 'DRAFT' THEN 'NEEDS_REVIEW'
          ELSE p.status::text
        END AS status,
        p."inHandsDate",
        p."orderDate",
        p."createdAt",
        p."reorderedFromId",
        p."originalOrderDate",
        p."timesReordered",
        p."lastReorderedAt",
        p."quoteResponse",
        (
          SELECT COUNT(*)::int
          FROM "ProjectItem" pi
          WHERE pi."projectId" = p.id
        ) AS "lineItemCount",
        -- Number of designs = line items in the canonical Project JSON.
        -- Drives the "+N Designs" card badge for multi-design projects.
        CASE WHEN jsonb_typeof(p."lineItemsData") = 'array'
             THEN jsonb_array_length(p."lineItemsData") ELSE 0 END AS "designCount",
        -- Primary card thumbnail = first line item that carries a mockup.
        -- Customer-safe: only the mockup URI is exposed (never cost/markup).
        (
          SELECT li->>'mockupUri'
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(p."lineItemsData") = 'array'
                 THEN p."lineItemsData" ELSE '[]'::jsonb END
          ) li
          WHERE COALESCE(li->>'mockupUri', '') <> ''
          LIMIT 1
        ) AS "thumbUri",
        -- Primary card image for the My Projects grid. Intended priority:
        --   1) Approved mockup  2) Latest mockup  3) Product image  4) Fallback (initials)
        -- Only the mockup tier is backed by data today (line items carry a single
        -- mockupUri with no approval flag or product-image link), so this resolves
        -- to the first line-item mockup and falls through to NULL (grid renders its
        -- own initials fallback). Customer-safe: only the mockup URI is exposed.
        (
          SELECT li->>'mockupUri'
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(p."lineItemsData") = 'array'
                 THEN p."lineItemsData" ELSE '[]'::jsonb END
          ) li
          WHERE COALESCE(li->>'mockupUri', '') <> ''
          LIMIT 1
        ) AS "primaryImageUri",
        -- ── Asset counts (drive the project-card asset summary) ──────────────
        -- Customer-safe: only counts of CLIENT_VISIBLE files / non-draft
        -- invoices. Mockups = approved (on-quote) mockups carried on line items
        -- (li.mockupUri) PLUS historical CLIENT_VISIBLE MOCKUP files not already
        -- referenced by a line item, matching the Project Assets mockup gallery.
        (
          (SELECT COALESCE(SUM(
             CASE
               WHEN jsonb_typeof(li->'mockups') = 'array' AND jsonb_array_length(li->'mockups') > 0
                 THEN jsonb_array_length(li->'mockups')
               WHEN COALESCE(li->>'mockupUri', '') <> '' THEN 1
               ELSE 0
             END), 0)
           FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(p."lineItemsData") = 'array'
                  THEN p."lineItemsData" ELSE '[]'::jsonb END
           ) li)
          + (SELECT COUNT(*) FROM "File" f
               WHERE f."projectId" = p.id AND f.visibility = 'CLIENT_VISIBLE'
                 AND f."fileType" = 'MOCKUP'
                 AND COALESCE(p."lineItemsData"::text, '') NOT LIKE '%' || f.id || '%')
        )::int AS "mockupCount",
        (SELECT COUNT(*) FROM "File" f
           WHERE f."projectId" = p.id AND f.visibility = 'CLIENT_VISIBLE' AND f."fileType" = 'ARTWORK')::int AS "artworkCount",
        (SELECT COUNT(*) FROM "File" f
           WHERE f."projectId" = p.id AND f.visibility = 'CLIENT_VISIBLE' AND f."fileType" = 'PROOF')::int AS "proofCount",
        (
          (SELECT COUNT(*) FROM "Invoice" i WHERE i."projectId" = p.id AND i.status::text <> 'DRAFT')
          + (SELECT COUNT(*) FROM "File" f
               WHERE f."projectId" = p.id AND f.visibility = 'CLIENT_VISIBLE' AND f."fileType" = 'INVOICE_PDF')
        )::int AS "invoiceCount",
        -- Customer-facing totals come from the canonical Project JSON
        -- (Project.calculations), NOT the mostly-empty relational Quote table.
        NULLIF(p.calculations->>'total', '')::numeric          AS "totalCost",
        NULLIF(p.calculations->>'totalQuantity', '')::int      AS "pieces",
        NULLIF(p.calculations->>'totalPerPiece', '')::numeric  AS "perPiece"
      FROM "Project" p
      WHERE p."organizationId" = $1
        AND p.status != 'CANCELLED'::"ProjectStatus"
      ORDER BY p."createdAt" DESC
      LIMIT 100`,
      [orgId]
    );

    return Response.json(result.rows);
  } catch (err) {
    console.error('[GET /api/portal/[orgId]/projects]', err);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
