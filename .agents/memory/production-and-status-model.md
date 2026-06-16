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

## Production module — a lens, not a table
The Production module is a **lens over existing operational projects** (those with an
operational status) — it has NO own table or pipeline model. The 10 operational statuses are
bucketed into 4 board columns; Board + Queue share one filter/sort/search model so a saved
view round-trips between them. Saved views + remembered default persist per-user in
AsyncStorage (matches how the app already stores user prefs; no server sync in V1).
**Why:** production answers "what's next / in production / blocked / due" without duplicating
records — keep it derived, never a parallel store.
- **Priority** is a first-class field on the Quote/Project (Critical/High/Normal/Low; default
  Normal), used for sorting. DB `PriorityLevel` enum was extended **additively**; the legacy
  value `RUSH` maps to **High** on read. Don't reintroduce RUSH in the UI.
- **Rush is a SEPARATE first-class boolean** (`Project.rush`, paid service level), NOT the
  legacy `PriorityLevel.RUSH` enum and NOT priority. Never conflate the two: a project can be
  Normal priority AND rush. Board sort order is rush → priority → due. **Why:** rush is a paid
  expedite flag independent of how important the work is; the old RUSH-as-priority value is
  legacy and maps to High. Added via targeted `ALTER TABLE ... ADD COLUMN IF NOT EXISTS rush`
  (never destructive `db push --accept-data-loss`, see prisma-push-drift).
- **Saved views = built-in presets + user custom, merged by id.** `buildDefaultViews()` returns
  fixed presets (ids `builtin_*`); custom views live in AsyncStorage. The remembered default and
  "apply view by id" must resolve across BOTH lists, or a built-in default silently won't apply
  on load. Built-in views are not deletable; custom are.
- **Service type is derived from line items** (a project can mix service styles), not a single
  column. The due-date filter is a **range preset** (Overdue/Today/7d/30d), kept as a filter
  field so it persists in saved views.
- Priority/assignee mutations follow the operational-status mutation pattern (spread cached
  quote + actorName, PUT, invalidate) — the API has no server-side authz (see api-no-server-authz).

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
