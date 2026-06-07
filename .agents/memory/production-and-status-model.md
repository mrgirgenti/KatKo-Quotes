---
name: Production module plan + dual-status reality
description: The Production module design lives in docs/; plus the durable fact that the app runs on frontendStatus (string) + lineItemsData JSON, not the Prisma enums.
---

# Production module architecture

Full design lives in `docs/production-module-architecture.md` (13-stage `productionStatus`
pipeline, `ProductionTask` model, Kanban/List/Calendar board, Queue, KPIs, client-hub
visibility, phased roadmap). It is DESIGN ONLY — no code shipped yet.

Key design decisions to keep if/when building:
- **Two levels:** project-level `productionStatus` (the 13 stages) drives the board/columns;
  granular work is `ProductionTask` rows (type ART/ORDERING/PRINTING/EMBROIDERY/DTF/
  FINISHING/QC/DELIVERY). The empty `app/(tabs)/tasks.tsx` placeholder becomes the
  per-assignee "My Work" inbox over ProductionTasks.
- **Printing/Embroidery/DTF are PARALLEL**, chosen per line-item `serviceStyle`, NOT
  sequential. Kanban groups them under one "Production" phase column with method swimlanes;
  rollup = least-advanced method until all method tasks done → Finishing.
- Add `productionStatus` as its OWN field, separate from `frontendStatus`, so the 13 stages
  don't pollute Sales/Projects pills, KPIs, and the portal pipeline.

## Dual-status reality (durable, not obvious from one file)
The runtime operational status is the **string** `Project.frontendStatus` (TS union in
`types/quote.ts`: draft, needs_review, quoting, quoted, invoice_sent, paid, active,
production_started, completed, expired). The Prisma `ProjectStatus`/`QuoteStatus` **enums
exist but are NOT what the UI reads** — runtime uses raw `pg` + `frontendStatus`.
**Line items live in `Project.lineItemsData` (JSON), not normalized `ProjectItem` rows.**
**How to apply:** new status-like fields should be plain String columns + a TS union
(mirror `QuoteStatus`), and anything referencing a line item should use the JSON line-item
id (string), not a `ProjectItem` FK. Apply schema via `prisma db push`, then verify live
columns (silent-500 gotcha).
