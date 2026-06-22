# Client Hub Data Integrity Audit → Sequenced Implementation Roadmap

**Status:** Roadmap for review only. No implementation in this document.
**Source:** Consolidated from the session's audits — Project Data Integrity, Portal File Visibility, Mockup Designer, File Storage, and Product Catalog architecture analyses, all confirmed against live data.

### Legends
- **Risk (launch):** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low
- **Effort:** S ≈ <0.5 day · M ≈ 0.5–1.5 days · L ≈ 2–4 days · XL ≈ 1+ week *(engineering only, excludes review/QA)*

### Standing guardrails (apply to every item)
- **Clerk/auth is FROZEN** — no portal auth path may be touched. Portal routes must stay token/Clerk-free.
- **Products ≠ product universe** — never gate quoting/mockups on the catalog; soft, nullable links only.
- **Schema/DB drift is real** — verify every new query field against `information_schema` before use; null-guard JSON reads.
- **Switching data sources will change numbers clients see** — this is correct, but flag before shipping.

---

## Launch-risk priority order (the sequence I recommend building in)

| # | Issue | Phase | Risk | Effort | Why this slot |
|---|---|---|---|---|---|
| 1 | P2.1 List totals read empty `Quote` table | 2 | 🔴 | S | One-file fix; kills the most visible breakage (blank totals) |
| 2 | P1.2 Portal media endpoint has no visibility filter | 1 | 🔴 | M | Cross-client / internal-IP exposure at launch |
| 3 | P2.2 / P2.3 "PCS" + per-piece use wrong/absent data | 2 | 🟠 | S | Same DTO as #1; trivial once there |
| 4 | P1.3 / P1.4 Identity backfill + grant/revoke durability | 1 | 🟠 | M | Locks in the linkedUserId foundation (P1.1 already built) |
| 5 | P2.4 Unify list + detail on one source | 2 | 🟠 | M | Removes dual-source inconsistency permanently |
| 6 | P4.1–P4.5 Customer visibility rules | 4 | 🟠 | M–L | IP/margin exposure; depends on P1.2 infra |
| 7 | P3.1 Make mockups visible to clients (stopgap) | 3 | 🟠 | S | Restores core approval value with existing data |
| 8 | P2.5 / P2.6 Invoice strategy decision | 2 | 🟡 | L | **Decision gate** for all Phase 5 invoice work |
| 9 | P3.2–P3.5 Mockup storage + resolver rework | 3 | 🟡 | L–XL | Foundational; post-launch |
| 10 | Phase 5 enhancements | 5 | 🟡–🟢 | L–XL | Net-new views; post-launch |

---

## PHASE 1 — Critical Data Integrity
*Foundational correctness and exposure. Highest launch risk.*

### P1.1 — Contact ↔ User ↔ Membership not unified on `linkedUserId`  ✅ *implemented this session (Phase A)*
- **Root cause:** CRM granted hub access (created User + Membership) but never wrote `Contact.linkedUserId`, and resolved hub state by **email matching**, while `hub/[id].tsx` already used `linkedUserId` — so the two screens disagreed. Email is non-unique across orgs (live data: two contacts share `josh@katalystko.com` in different orgs).
- **Files affected:** `app/crm/[id].tsx`, `app/api/orgs/[id]/contacts/[contactId]+api.ts` (PUT), `app/api/orgs/[id]/contacts+api.ts` (POST), `app/hub/[id].tsx`, `contexts/CrmContext.tsx`.
- **Risk:** 🔴 Critical — wrong client shown as having/lacking hub access; cross-org email collisions mislink identities.
- **Recommended fix:** `linkedUserId` is the single authoritative key. Resolve hub access via `linkedUserId → CLIENT membership`; persist on grant, clear on revoke; PUT persists `linkedUserId`. **Done in this session**; final typecheck + architect review were paused by the planning redirect.
- **Dependencies:** none — foundation for P1.3, P1.4 and all hub readiness logic.
- **Effort:** M *(substantially complete; remaining = durability P1.4 + verification).*

### P1.2 — Portal media-bin endpoint has **no visibility filter**
- **Root cause:** `/api/portal/[orgId]/files` returns **all** org files (`projectId IS NULL`) with no `visibility` or `fileType` filter. Staff-uploaded/internal artifacts — and future invoice PDFs — would surface directly to clients. Cross-client safety today rests only on the `organizationId` check in serve routes.
- **Files affected:** `app/api/portal/[orgId]/files+api.ts`, `app/api/portal/[orgId]/files/[fileId]+api.ts`, `prisma/schema.prisma` (`File.visibility`), portal `MediaCard` consumers in `app/portal/[orgId].tsx`.
- **Risk:** 🔴 Critical — leak of internal/production IP and (later) invoices to clients.
- **Recommended fix:** Filter the portal query to `CLIENT_VISIBLE` and exclude internal-only `fileType`s; this is the **enabling infrastructure** for all of Phase 4. Verify org-scope on every serve route.
- **Dependencies:** none to start; **enables** P4.1, P4.2, P4.4, P4.5.
- **Effort:** M.

### P1.3 — Orphaned CLIENT membership + incomplete identity backfill
- **Root cause:** A CLIENT membership exists with no matching Contact (`jane.smith@testclient.com`, test data). Historical links were never systematically backfilled. One safe, guarded backfill (Josh Girgenti → his ORG_ADMIN client user) was applied this session; a full multi-org reconciliation has not run.
- **Files affected:** DB data + a one-off reconciliation/audit script; surfaced in `app/hub/[id].tsx` and `app/crm/[id].tsx`.
- **Risk:** 🟠 High — readiness/metrics misreport; orphan logins aren't represented in CRM.
- **Recommended fix:** Reconciliation pass that links contacts↔users by **(org + verified membership)**, never by email alone; flag/clean orphan memberships. Idempotent and guarded (`linkedUserId IS NULL` only; never overwrite).
- **Dependencies:** P1.1.
- **Effort:** S–M.

### P1.4 — Grant/revoke durability (fire-and-forget mutations)
- **Root cause:** `addContact`/`updateContact` are fire-and-forget `.mutate`. The grant path is multi-step (create user → create membership → write `linkedUserId`); a partial failure leaves a membership with no linked contact (or a link with no membership), silently re-introducing P1.1.
- **Files affected:** `app/crm/[id].tsx` (`handleSaveContact`, `handleEnableHubFromCard`), `contexts/CrmContext.tsx`, optionally a new transactional server endpoint.
- **Risk:** 🟠 High — silent desync regresses the Phase 1 foundation.
- **Recommended fix:** Move grant/revoke into a **single server transaction** (one endpoint that creates user + membership + sets `linkedUserId` atomically), or await each step with repair/rollback and surface failures in the UI.
- **Dependencies:** P1.1.
- **Effort:** M.

---

## PHASE 2 — Project / Quote / Invoice Consistency
*The headline defect: list/summary screens read different (mostly empty) sources than detail screens.*

### P2.1 — List totals read the empty `Quote` table → blank totals
- **Root cause:** The project **list** DTO computes `totalCost` from the relational `Quote` table (live: **1 row total**), so ~9/10 projects return `null`. The correct value (`calculations.total`) is populated for all projects and used by **detail** endpoints.
- **Files affected:** `app/api/portal/[orgId]/projects+api.ts`; `app/portal/[orgId].tsx`.
- **Risk:** 🔴 Critical — clients see blank/$0 totals on My Projects and Dashboard.
- **Recommended fix:** Read `totalCost` from `calculations.total` (null-guarded); stop joining `Quote` for totals.
- **Dependencies:** none — highest-impact single-file fix.
- **Effort:** S.

### P2.2 — "PCS" shows line-item count, not garment quantity
- **Root cause:** The list maps `lineItemCount` (1–2) into the PCS column. Real piece count is `calculations.totalQuantity` (36–422) and is never sent.
- **Files affected:** `app/api/portal/[orgId]/projects+api.ts`; `app/portal/[orgId].tsx`.
- **Risk:** 🟠 High — misleading order size.
- **Recommended fix:** Add `pieces = calculations.totalQuantity`; keep `lineItemCount` separate; relabel the column.
- **Dependencies:** P2.1 (same DTO/file).
- **Effort:** S.

### P2.3 — Per-piece computed client-side on absent data
- **Root cause:** UI computes `totalCost / lineItemCount` (= null ÷ 1). Correct `calculations.totalPerPiece` exists but isn't sent.
- **Files affected:** `app/api/portal/[orgId]/projects+api.ts`; `app/portal/[orgId].tsx`.
- **Risk:** 🟠 High.
- **Recommended fix:** Send `perPiece` from the server; remove the client-side division.
- **Dependencies:** P2.1.
- **Effort:** S.

### P2.4 — Unify list + detail on `Project` JSON as the single source of truth
- **Root cause:** Dual source of truth — list joins relational `Quote`/`ProjectItem`; detail reads `Project.lineItemsData` + `calculations` JSON. Same project shows different numbers depending on the screen. The one project with a `Quote` row even disagrees with itself (`quote.total` 440.33 vs `calculations.total` 256.56).
- **Files affected:** `app/api/portal/[orgId]/projects+api.ts`, `app/api/portal/[orgId]/projects/[projectId]+api.ts`, `app/api/portal/quote/[id]+api.ts`.
- **Risk:** 🟠 High — architectural consistency; recurring data drift.
- **Recommended fix:** Make `Project` JSON the canonical read source for **both** list and detail (lower-risk, smaller change), or backfill+sync the relational tables. Send computed metrics (`total`, `pieces`, `perPiece`) from the server so list and detail are identical by construction.
- **Dependencies:** P2.1–P2.3 (apply the field fixes first, then unify).
- **Effort:** M.

### P2.5 — Invoice system not wired to the portal  ⚠️ *decision gate*
- **Root cause:** New `Invoice`/`InvoiceLineItem` tables exist (invoiceNumber, status, subtotal, tax, total, amountPaid, balance, dueDate, paidAt, paymentUrl) but the portal still uses the legacy `Project.waveInvoiceLink` string + `invoiceNumber`. No Invoice DTO reaches the portal; no History/Detail views.
- **Files affected:** `app/api/projects/[id]/invoice+api.ts`, a new portal invoice endpoint, `app/portal/[orgId].tsx`, `prisma/schema.prisma`.
- **Risk:** 🟡 Medium — but blocks Phase 5 invoice UX.
- **Recommended fix:** **Decide first:** (a) adopt native `Invoice` table → deprecate Wave, build History/Detail (P5.1); or (b) formally keep Wave and stop building the `Invoice` table. Do not maintain both.
- **Dependencies:** P1.2 + P4.2 (invoices must not leak into the general media bin).
- **Effort:** L *(if native; gated on the decision).*

### P2.6 — Quote vs Invoice status collapsed into one `status`
- **Root cause:** Portal collapses everything into `Project.status`; quote status and invoice status aren't distinct pipelines (they're status filters over one list).
- **Files affected:** `app/api/portal/[orgId]/projects+api.ts`; `app/portal/[orgId].tsx`.
- **Risk:** 🟡 Medium.
- **Recommended fix:** Surface distinct quote/invoice states once the invoice strategy is decided.
- **Dependencies:** P2.5.
- **Effort:** M.

---

## PHASE 3 — Mockup Flow Integrity
*Mockups are captured internally but effectively invisible to clients, and stored in a way that can't scale.*

### P3.1 — Mockups invisible to clients
- **Root cause:** The quote DTO explicitly omits `mockupUri` from `clientLineItems`; the project-detail endpoint returns raw `lineItemsData` but the frontend never renders the mockup field.
- **Files affected:** `app/api/portal/quote/[id]+api.ts`, `app/portal/quote/[id].tsx`, `app/portal/[orgId].tsx`.
- **Risk:** 🟠 High — the core client value (approving mockups) is missing.
- **Recommended fix (stopgap):** Include `mockupUri` in the **detail** DTO (not the list — base64 bloat) and render it. This restores value before the deeper rework below.
- **Dependencies:** none for stopgap; full fix prefers P3.2.
- **Effort:** S (stopgap).

### P3.2 — Mockups stored as base64 in JSON (bloat, no `File` record)
- **Root cause:** `MockupDesigner.composeCanvas()` writes a base64 PNG data-URI into `Project.lineItemsData` (and `ProjectItem.rawLineItemData`); it never writes to the `File` table even though `FileType.MOCKUP` exists. Inflates the quote JSON on every save and can't be re-opened/CDN-served.
- **Files affected:** `components/MockupDesigner/MockupDesigner.tsx`, `components/LineItemCard.tsx`, `app/api/portal/submit+api.ts`, `app/api/files` (write path), `lib/storage/*`.
- **Risk:** 🟠 Medium-High — payload bloat; no re-edit; no CDN path.
- **Recommended fix:** Render to file storage, reference by `fileId`; keep a derived `mockupUri` URL for back-compat (PDF/production/portal readers); backfill existing blobs.
- **Dependencies:** P1.2 (portal mockup serving), storage abstraction.
- **Effort:** L.

### P3.3 — Mockup base resolver + design-vs-render split
- **Root cause:** The designer is self-contained with a 100%-hardcoded vendor catalog and generic SVG garments (polo/crewneck reuse the t-shirt path); output is a single un-editable flat PNG, with no separation between an editable design document and the rendered output.
- **Files affected:** `components/MockupDesigner/*`, `garmentData.ts`, `vendorCatalog.ts`, a new `Mockup` model.
- **Risk:** 🟡 Medium — foundational rework, not launch-blocking.
- **Recommended fix:** A **Mockup Base Resolver** (catalog `ProductAsset` / manual template / generic library) + store an editable design JSON with derived render PNGs. Catalog is an enhancement, never a requirement (Products ≠ universe).
- **Dependencies:** P3.2; product-catalog safeguards.
- **Effort:** XL.

### P3.4 — Placement vocabulary divergence
- **Root cause:** `garmentData.ts` uses a 500×600 canvas and custom zone names (Center Chest, Pocket, Neck Tag…); the DB uses the `PlacementType` enum (LEFT_CHEST, FULL_FRONT…) with Float coords. Catalog vs generic mockups place artwork differently.
- **Files affected:** `components/MockupDesigner/garmentData.ts`, placement resolver, `prisma` `PlacementType`.
- **Risk:** 🟡 Medium.
- **Recommended fix:** Unify to **one enum + one normalized (0–1) coordinate convention**; confirm the current Float convention before standardizing.
- **Dependencies:** P3.3.
- **Effort:** L.

### P3.5 — Mockup ↔ quoted product mismatch
- **Root cause:** The mockup's garment comes from the hardcoded mockup catalog, independent of the quoted product; nothing records or enforces that they match.
- **Files affected:** `components/MockupDesigner/*`, `components/LineItemCard.tsx`.
- **Risk:** 🟢 Low-Medium.
- **Recommended fix:** A **soft mapping** of mockup placements ↔ quote decoration locations & product — never a hard gate.
- **Dependencies:** P3.3, P3.4.
- **Effort:** M.

---

## PHASE 4 — Customer Visibility Rules
*Who is allowed to see which asset. Depends on the P1.2 filter infrastructure.*

### P4.1 — Asset visibility classification (INTERNAL vs CLIENT_VISIBLE)
- **Root cause:** Every file flows through the same endpoints with the same (absent) visibility; no distinction by origin or type.
- **Files affected:** `prisma/schema.prisma` (`File.visibility`), `app/api/files*`, `app/api/portal/[orgId]/files*`, `MediaUploader.tsx`, `OrgLogoUploader.tsx`, `MediaCard` (visibility badge).
- **Risk:** 🟠 High — IP exposure.
- **Recommended fix:** Per-type rules — staff-uploaded ARTWORK = `INTERNAL`; client-submitted ARTWORK = `CLIENT_VISIBLE`; MOCKUP/PROOF/INVOICE_PDF = `CLIENT_VISIBLE`. Portal filters to `CLIENT_VISIBLE`; the internal Media Bin shows a lock badge so staff know what clients can see.
- **Dependencies:** P1.2.
- **Effort:** M.

### P4.2 — Exclude INVOICE_PDF + internal artwork from the general media bin
- **Root cause:** The portal files API returns all `projectId IS NULL` files; invoices and internal artwork would leak into the general media bin.
- **Files affected:** `app/api/portal/[orgId]/files+api.ts`.
- **Risk:** 🟠 High.
- **Recommended fix:** Add a `fileType` exclusion (no `INVOICE_PDF`) and a `CLIENT_VISIBLE` filter; invoices/proofs get their own sections (Phase 5).
- **Dependencies:** P1.2, P4.1.
- **Effort:** S.

### P4.3 — Per-line pricing must never reach client DTOs
- **Root cause:** The quote DTO currently drops `productCostEach`/`serviceCostEach`/`markupEach` — but incidentally, not by enforced design; easy to re-add by accident.
- **Files affected:** `app/api/portal/quote/[id]+api.ts`, `app/api/portal/[orgId]/projects*+api.ts`.
- **Risk:** 🟡 Medium — margin exposure if regressed.
- **Recommended fix:** Make the omission explicit and tested — **whitelist** client-safe fields rather than blacklist sensitive ones.
- **Dependencies:** none.
- **Effort:** S.

### P4.4 — Studio-owned source artwork must be INTERNAL
- **Root cause:** Raw source files (`.ai`, `.dst`, `.emb`, `.pes`) are studio-prepared production IP, but currently share visibility with client submissions.
- **Files affected:** `app/api/files` (upload classification), `MediaUploader.tsx`, portal files filter.
- **Risk:** 🟠 High — IP leak / download path to studio work.
- **Recommended fix:** Origin-based split — client origin → public/visible; studio origin → private/internal.
- **Dependencies:** P4.1.
- **Effort:** S–M.

### P4.5 — Verify cross-client access protection (org-scope)
- **Root cause:** Cross-client safety depends on the `organizationId` check in serve routes; it must be verified everywhere, especially for invoices.
- **Files affected:** `app/api/portal/[orgId]/files/[fileId]+api.ts`, invoice serve routes.
- **Risk:** 🟠 High — cross-client data access.
- **Recommended fix:** Audit every portal serve route to enforce org scope; add regression tests.
- **Dependencies:** P1.2.
- **Effort:** S.

---

## PHASE 5 — Customer Experience Enhancements
*Net-new client-facing value. Post-launch; several gated on Phase 2/3/4 decisions.*

### P5.1 — Invoice History + Invoice Detail portal views
- **Root cause / gap:** No Invoice History or Detail; the portal falls back to Quote Detail or an external Wave link.
- **Files affected:** new portal invoice endpoint(s) + portal UI sections in `app/portal/[orgId].tsx`.
- **Risk:** 🟡 Medium. **Dependencies:** P2.5 (decision), P4.2. **Effort:** L.

### P5.2 — Proof approval flow ("Pending Approval" section)
- **Root cause / gap:** Proofs (`FileType.PROOF`) are project-scoped and don't appear in the portal's `projectId IS NULL` view; no approval workflow exists.
- **Files affected:** new **portal-specific** proof routes (note: `/api/files` is Clerk-gated, unusable from the portal), portal project-detail UI.
- **Risk:** 🟡 Medium. **Dependencies:** P1.2, P4.1. **Effort:** L.

### P5.3 — Mockup approval flow (draft → sent-for-proof → approved/changes)
- **Root cause / gap:** No mockup status lifecycle drives the portal approval flow.
- **Files affected:** `Mockup` model/status, portal approval UI, portal-specific routes.
- **Risk:** 🟡 Medium. **Dependencies:** P3.2, P3.3. **Effort:** L.

### P5.4 — Surface richer fields + correct metrics on list/detail cards
- **Root cause / gap:** Service Style / Products / Colors / Print Locations are absent from list cards (detail-only); product/color per line are dropped from the quote DTO (survive only inside `garmentVariants`).
- **Files affected:** `app/api/portal/[orgId]/projects+api.ts`, `app/api/portal/quote/[id]+api.ts`, `app/portal/[orgId].tsx`, `app/portal/quote/[id].tsx`.
- **Risk:** 🟢 Low-Medium. **Dependencies:** P2.1–P2.4. **Effort:** M.

### P5.5 — Dedicated portal sections (Invoices, Proofs) vs status filters
- **Root cause / gap:** "Submitted / Active / Completed / Quote History / Invoice History" are status filters over one list, not real sections.
- **Files affected:** `app/portal/[orgId].tsx`, supporting endpoints.
- **Risk:** 🟢 Low. **Dependencies:** P5.1, P5.2. **Effort:** M.

### P5.6 — Org-level reusable mockup library
- **Root cause / gap:** No `organizationId`-scoped reusable mockup catalog for clients.
- **Files affected:** `Mockup` model (`organizationId`), portal library UI.
- **Risk:** 🟢 Low. **Dependencies:** P3.3. **Effort:** L.

---

## Cross-phase dependency map (build order constraints)
- **P1.2** (portal visibility filter) is the prerequisite for **all of Phase 4** and the invoice/proof sections in Phase 5.
- **P2.1 → P2.2/P2.3 → P2.4** must go in order (same DTO, then unify).
- **P2.5** (invoice strategy) is a **decision gate** for **P2.6, P5.1, P5.5**.
- **P3.2** (mockups → File storage) precedes **P3.3 → P3.4 → P3.5** and **P5.3/P5.6**.
- **P1.1** (done) underpins **P1.3, P1.4** and hub readiness/metrics.

## Open decisions needed before building
1. **Invoice strategy (P2.5):** native `Invoice` table vs legacy Wave link — this gates a large slice of Phase 5.
2. **Source-of-truth strategy (P2.4):** make `Project` JSON canonical vs backfill the relational tables. (Recommended: JSON canonical — smaller, lower-risk.)
3. **Mockup re-architecture scope (P3.x):** ship the P3.1 stopgap for launch and defer P3.2–P3.5, or invest in the full resolver now.
