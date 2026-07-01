# Platform Roadmap

## Purpose

This document is the authoritative source for the long-term product direction of the **Katalyst Ko Quote Tracker 5000** platform. It exists to keep development aligned with the approved vision and to prevent:

- **Feature creep** — building things that aren't part of the approved direction
- **Duplicate work** — building modules that overlap with planned or existing ones
- **Out-of-sequence development** — building Phase 4 infrastructure before Phase 2 foundations are solid
- **Reconsidering rejected ideas** — relitigating decisions that have already been made

This is not a backlog. It is not a task list. It is the approved product direction. Implementation tasks that conflict with this roadmap must be identified before implementation begins.

---

## Implementation Rule

Before implementing any significant new feature, check this document.

If a requested feature is listed under **Deferred** or **Won't Build**, stop. Identify the conflict and request explicit approval before proceeding. Do not silently change product direction.

If a feature is listed in a future phase, it should be built in the context of that phase — not pulled forward in isolation if it creates architectural debt for intervening phases.

---

## Current Project Status

The platform has completed its foundational systems and is actively being hardened before Beta release.

### Completed Systems

| System | Status |
|---|---|
| **Authentication** | Complete — Clerk auth, role-based access (`org_admin` / `user`), frozen |
| **Quote Builder** | Complete — new and edit flows, multi-design quotes |
| **Multi-Product Quoting** | Complete — multiple `ConfiguredProduct` per Line Item |
| **Pricing Engine** | Complete — five-bucket model (Product / Service / Production / Other / Markup) |
| **Size Upcharges** | Complete — 2XL–6XL upcharges threaded to all calculation surfaces |
| **Cost Configuration** | Complete — AppSettings-driven: Product Pricing, Taxes & Fees |
| **Production Library** | Complete — saved itemized Production Cost rows |
| **Other Charges Library** | Complete — saved itemized Other Charge rows |
| **Service Styles** | Complete — garment vs. promotional quantity modes |
| **Adjustment Engine** | Complete — flat, hourly, per_unit, percentage row types |
| **Project Lifecycle** | Complete — Draft → Quoted → Active → In Production → Completed |
| **CRM Foundation** | Complete — Organizations, Contacts, Activities, Leads |
| **Client Hub Foundation** | Complete — per-org portal, project status, file visibility |
| **Customer Portal Foundation** | Complete — unauthenticated access, DTO sanitization, customer-safe pricing |
| **File Management / Media Bin** | Complete — upload, preview, visibility rules, R2 storage abstraction |
| **PDF Generation** | Complete — Quote, Invoice, Production Punch Sheet (one template, multiple modes) |
| **Mockup Builder** | In progress — smart placement, template system, artwork layers |
| **Reporting** | Foundation — CSV and Google Sheets export |
| **Invoicing** | Foundation — Invoice records, PDF generation, sent/draft status |

### Current Focus

Pricing Engine hardening and regression test coverage before Beta. All pricing surfaces (Quote Builder, CalculationDisplay, portal DTO, PDFs) must produce consistent, correct totals before the platform is used for live client quotes.

---

## Current Development Phase

### Phase 1 — Pricing Engine Hardening *(active)*

**Objective:** Eliminate all pricing drift, ensure upcharges reach every calculation surface, and establish a regression test suite that prevents future regressions.

| Milestone | Status |
|---|---|
| Five-bucket pricing model established | ✅ Complete |
| Multi-product cost blending (`getLineItemProducts`) | ✅ Complete |
| `calculateLineItemSubtotal` / `calculateQuote` architecture | ✅ Complete |
| `validateProductPricingConsistency` guard | ✅ Complete |
| `updateDesignFields` preserves service style correctly | ✅ Complete |
| Service style drift prevention on DB reload | ✅ Complete |
| Size upcharges threaded to Quote Builder, portal, CalculationDisplay | ✅ Complete |
| Regression test suite (`pricing.test.ts`, `pricing-drift.test.ts`, `upcharge-regression.test.ts`) | ✅ Complete — 127 tests passing |
| Beta readiness validation | ⬜ In progress |

---

## Roadmap

### Phase 2 — Mockup Builder

**Objective:** Give shop staff a first-class tool for placing artwork on garment templates, generating proofs, and delivering visual approvals to clients through the Client Hub.

Goals:
- Garment template library (front/back/sleeve views per product type)
- Artwork upload and layer management
- Smart placement zones — snap-to-location for Left Chest, Full Back, etc.
- Safe area and print boundary enforcement
- Scale, position, and rotation controls
- Multi-location artwork placement per design
- Proof generation — export mockup as a client-presentable image
- Proof delivery through the Client Hub (mark as CLIENT_VISIBLE)
- Client approval workflow — approve or request changes from the portal
- `computeArtRect` as the single source of truth for display and export

Dependencies: Phase 1 complete (line item structure must be stable before mockup placement can be finalized).

---

### Phase 3 — Production Workflow

**Objective:** Give the production team a complete internal workflow from job intake through garment decoration and fulfillment.

Goals:
- Production Punch Sheets — per-job print-ready production documents
- Production Queue — ordered list of active jobs with status tracking
- Artwork approval tracking — link client approvals to production release
- Order status updates — shop staff can advance jobs through production stages
- Internal production notes and activity log
- Scheduling — assign jobs to production dates based on in-hands dates
- Garment receiving — mark blanks as received before production can begin
- Production reporting — jobs in queue, completion rate, bottlenecks

Dependencies: Mockup Builder (Phase 2) must be stable so approved proofs can gate production release.

---

### Phase 4 — Storefronts

**Objective:** Allow the shop to create branded online stores for clients — fundraising campaigns, team stores, and ongoing product stores.

Goals:
- Web Store builder — create a branded store per organization or campaign
- Product catalog for storefronts (distinct from the internal quoting catalog)
- Online ordering — clients and end-customers can place orders directly
- Payment processing integration (Stripe or equivalent)
- Inventory visibility — show available sizes/colors in the store
- Fundraising mode — stores with a goal amount and campaign end date
- Order aggregation — combine storefront orders into a production run
- Store analytics — orders placed, revenue, campaign performance

Dependencies: Phase 3 (Production Workflow) must handle the production side of storefront orders.

---

### Phase 5 — Operations

**Objective:** Give the shop a complete back-office operations platform covering inventory, purchasing, vendor management, and accounting.

Goals:
- **Inventory** — track blank garment stock levels by style, color, and size
- **Purchasing** — create purchase orders to vendors; track outstanding orders
- **Receiving** — log received shipments; reconcile against purchase orders
- **Vendor Management** — vendor contacts, lead times, preferred vendors per product type
- **Accounting Integration** — export invoices and payments to QuickBooks or Xero
- **Advanced Reporting** — revenue by client, rep, service style, and time period; margin analysis; production throughput
- **Supplier Catalog Sync** — pull live pricing from distributor APIs (SanMar, S&S Activewear, Alpha Broder)

Dependencies: Phases 1–3 complete; stable invoice and project data for accounting export.

---

## Approved Modules

These are the approved top-level modules of the platform. New modules are added here only when explicitly approved.

| Module | Phase | Status |
|---|---|---|
| Quote Builder | 1 | ✅ Complete |
| Pricing Engine | 1 | ✅ Complete |
| Cost Configuration | 1 | ✅ Complete |
| CRM | Foundation | ✅ Complete |
| Client Hub | Foundation | ✅ Complete |
| File Library / Media Bin | Foundation | ✅ Complete |
| Invoicing | Foundation | ✅ Complete |
| Reporting (basic) | Foundation | ✅ Complete |
| Mockup Builder | 2 | 🔄 In progress |
| Production Workflow | 3 | ⬜ Planned |
| Scheduling | 3 | ⬜ Planned |
| Storefronts / Web Stores | 4 | ⬜ Planned |
| Payments | 4 | ⬜ Planned |
| Inventory | 5 | ⬜ Planned |
| Purchasing & Receiving | 5 | ⬜ Planned |
| Vendor Management | 5 | ⬜ Planned |
| Accounting Integration | 5 | ⬜ Planned |
| Advanced Reporting | 5 | ⬜ Planned |

---

## Deferred Features

These features are intentionally postponed. They are valid ideas that do not belong in the current phase. They are documented here so they are not lost — and so they are not accidentally built before their time.

| Feature | Reason for deferral |
|---|---|
| **Detailed pricing audit UI** | Not required for Beta. The pricing engine calculates correctly. Future debugging tooling belongs in admin tools, not the Quote Builder. |
| **Per-organization pricing overrides** | Global upcharge and fee rates satisfy current business needs. Per-org overrides add significant complexity. Revisit in Phase 3 or 5. |
| **Decoration-method-specific size upcharges** | Current flat size upcharges (2XL–6XL) satisfy all known business scenarios. Method-specific overrides (e.g., embroidery vs. screen print) are not yet requested. |
| **Automated supplier catalog sync** | Distributor APIs (SanMar, S&S) exist but require per-catalog API agreements. Planned for Phase 5. Manual entry is sufficient for Beta. |
| **Client-facing price negotiation / counter-offers** | Complex workflow with no current business demand. Portal quote acceptance/decline satisfies the current need. |
| **Scheduling calendar view** | Production scheduling is planned for Phase 3. A calendar UI is a Phase 3 deliverable, not a Phase 1 or 2 one. |
| **Multi-shop / multi-location support** | Per-org Client Hub already provides org isolation. Full multi-location pricing and routing is a post-Phase-5 consideration. |
| **Mobile app (native iOS/Android)** | The SSR Expo web app is responsive and covers mobile browsers. A native app binary is not on the current roadmap. |

---

## Won't Build

These ideas have been explicitly rejected. They are documented so they are not repeatedly reconsidered. Any proposal to revisit a "Won't Build" item requires an explicit architectural discussion and approval.

| Feature | Reason |
|---|---|
| **ERP-style cost breakdown inside the Quote Builder** | Adds unnecessary cognitive load for shop staff. The five-bucket model is the right level of detail. Deeper breakdowns belong in reports, not in the quoting workflow. |
| **Merging Production Costs and Other Charges into a single bucket** | These are architecturally distinct: Production Costs affect the markup percentage base; Other Charges do not. Merging them would produce incorrect markup percentages and confuse shop staff. |
| **Product catalog as a quoting gate** | Quoting must always be free-text. The catalog is an optional enhancement layer, never a requirement. Gating quoting on the catalog would prevent quoting unlisted products and violate the Product Model Law. |
| **Storing markup as a percentage** | Markup is stored as `markupEach` (dollar per piece). The percentage is derived for display only. Storing a percentage creates a circular dependency with the base it's calculated against. |
| **Per-line-item online fee / card fee / sales tax** | Fees are quote-level, not line-item-level. Applying fees per line item would produce incorrect totals for multi-design quotes. |

---

## Architectural Milestones

These represent significant architectural decisions that define the platform's foundation. They are documented here as permanent reference points.

| Milestone | Description |
|---|---|
| **Five-bucket pricing model** | All line item costs flow through exactly five named buckets: Product, Service, Production, Other, Markup. This is the permanent pricing architecture. |
| **Multi-product line items** | A Line Item (design) can contain multiple Configured Products (garments). Each product has independent cost; service, markup, and locations are shared. |
| **Service Style architecture** | Service Style determines quantity mode: garment sizes (XS–4XL) for decorated apparel; flat quantity for promotional items. Size upcharges apply only in garment mode. |
| **Cost Configuration via AppSettings** | All pricing rules (upcharges, fee rates) are stored as global AppSettings, not hardcoded. Client-side access via React hooks; server-side access via `pool.query` helpers. |
| **Quote Builder / Mockup Builder separation** | The Quote Builder defines the job. The Mockup Builder visualizes it. They share Line Item data but have no direct dependency. The Mockup Builder never owns pricing. |
| **Shared pricing engine** | `calculateLineItemSubtotal` and `calculateQuote` in `utils/quoteCalculations.ts` are the single source of truth for all price calculations — used by the Quote Builder, portal DTO, PDFs, and tests. |
| **SSR Expo web app** | The app uses `web.output: "server"` — it is a Node/Bun SSR app, not a static export. API routes are server-side. React hooks cannot be used in API routes. |
| **Raw SQL over Prisma Client** | Due to NixOS binary incompatibility, all runtime DB access uses `pg` Pool directly. Prisma is used only for schema migrations (`prisma db push`). Prisma `String @id @default(uuid())` maps to PostgreSQL `text` — never cast to `::uuid` in SQL. |
| **Customer-safe portal DTO pattern** | Portal API routes must sanitize responses at the server. Cost, markup, COGS, and sourcing data are stripped before the response leaves the server. Only customer-visible fields are whitelisted. |
| **linkedUserId for hub access** | Client Hub access is tied to `Contact.linkedUserId` — never derived from email matching. One write path manages all provisioning. |

---

## Roadmap Maintenance

This document must be kept current. The following rules apply:

- **Completed milestones** — when a phase objective is fully complete, mark it ✅ in the phase table and add it to Architectural Milestones if it represents a significant architectural decision.
- **New approved modules** — add to the Approved Modules table only when explicitly approved.
- **Phase advancement** — when a phase is complete, update the Current Development Phase section to reflect the new active phase.
- **Deferred features** — remain documented indefinitely. Do not remove them when they are eventually built — move them to the appropriate phase section with a "built in Phase N" note.
- **Won't Build items** — remain documented permanently. They exist to prevent repeated reconsidering of rejected ideas.
- **Roadmap conflicts** — if a requested implementation conflicts with this document, the conflict must be surfaced before implementation begins, not discovered after the fact.
