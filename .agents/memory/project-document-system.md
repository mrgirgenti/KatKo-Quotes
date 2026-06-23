---
name: Unified Project Document system
description: One model + one HTML template renders the Client Hub Order Detail (web iframe) AND the Quote/Invoice/Production PDFs; customer per-line price must be server-computed.
---

# Unified Project Document system

A single normalized model (`utils/projectDocument.ts`) plus a single HTML template
(`utils/projectDocumentHtml.ts`) produce EVERY "project as a document" rendering.
`mode` (QUOTE | INVOICE | PRODUCTION | ORDER_DETAIL) flips section/column
VISIBILITY only — never the layout. Web embeds the same HTML via `<iframe srcDoc>`
(`components/ProjectDocument.tsx`); PDFs feed the same HTML to expo-print / file
download (`utils/pdfGenerator.ts`).

**Why:** the user was adamant — NO separate per-mode views, NO PDF-only layout.
Any new document-shaped surface must reuse this template, not hand-roll a parallel
one.

**How to apply:** add a field to the model + template once; gate it through
`getModeVisibility`. Don't fork the layout per mode.

## Customer-facing per-line price MUST be server-computed

The portal project API (`app/api/portal/[orgId]/projects/[projectId]+api.ts`)
strips ALL cost / markup / COGS inputs from line items before they reach the client
(privacy DTO). Therefore `calculateLineItemSubtotal` returns 0 in any
customer/portal context — you CANNOT recompute per-line pricing client-side there.

**How to apply:** the API computes the BUNDLED customer price server-side and ships
only `customerUnitPrice` / `customerLineTotal` (never the cost components).
`buildLineItem` prefers those explicit fields and falls back to cost-derived calc
only for the staff Quote path (whose items still carry the raw cost inputs). Order
totals come from the sanitized `calculations` (safeCalc), and `buildTotals` returns
no rows when totals are zero/empty so pending projects show NOTES full-width instead
of a misleading $0.00.
