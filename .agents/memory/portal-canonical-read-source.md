---
name: Client Hub portal canonical read source
description: Portal list/summary totals must come from Project.calculations JSON, never the Quote/ProjectItem relational tables.
---

# Portal Client Hub — canonical customer-facing read source

The Client Hub portal must read all customer-facing project numbers (total, pieces,
per-piece) from the **Project JSON** model:
- `Project.calculations.total` → total
- `Project.calculations.totalQuantity` → pieces (PCS)
- `Project.calculations.totalPerPiece` → per-piece

**Why:** The relational `Quote`/`ProjectItem` tables are the wrong source for the
portal. The `Quote` table is mostly empty (often 1 row across the whole DB), so list
DTOs that read `Quote.total` returned `null` → blank totals / false $0. And
`ProjectItem` row count (`lineItemCount`) is the number of line items (1–2), NOT the
garment quantity — using it for a "PCS" column is wrong; real piece count lives in
`calculations.totalQuantity` (e.g. 36/99/422). Detail endpoints already read the JSON,
so list-vs-detail showed different numbers for the same project (dual source of truth).

**How to apply:**
- The list endpoint (`/api/portal/[orgId]/projects`) and detail/quote endpoints must
  all derive total/pieces/perPiece from `calculations`. Never reintroduce a
  `Quote.total` or `lineItemCount`-as-pieces read for customer-facing values.
- `lineItemCount` (ProjectItem count) is fine ONLY for a literal "N line items" label,
  never for PCS.
- Null-guard: `calculations` can be null/partial on test rows — use
  `NULLIF(calculations->>'key','')::numeric` in SQL and `value != null` guards in UI.
- Both Dashboard and My Projects consume one shared `orgProjects` list state, so they
  stay aligned automatically as long as the single list DTO is correct.
