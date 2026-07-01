# Architecture Principles

## Purpose

This document defines the permanent architectural rules for the **Katalyst Ko Quote Tracker 5000**. It describes the approved boundaries between systems, who owns what data, and what is forbidden. Future implementations must respect these principles. Any deviation requires an explicit decision and a corresponding update to this document.

---

## Quote Builder

The Quote Builder is the primary tool for defining a job.

**It owns:**
- The list of line items (designs) on a job
- Per-design pricing inputs: `productCostEach`, `serviceCostEach`, `markupEach`, `productionCosts`, `otherCharges`
- Service style selection per line item
- Print location configuration
- Quantity entry (garment sizes or flat promotional qty)
- Link to configured products (garments/blanks)
- Draft and saved quote state

**It does NOT own:**
- Artwork visualization — that belongs to the Mockup Builder
- Pricing rules (upcharges, fee rates) — those are owned by Cost Configuration / AppSettings
- Project lifecycle state (Active, In Production, Completed) — that belongs to the Project

**Entry points:**
- New quote: `app/(tabs)/index.tsx`
- Edit existing quote: `app/quote/edit.tsx`
- Line item component: `components/LineItemCard.tsx`
- Summary panel: `components/CalculationDisplay.tsx`

**Rule:** The Quote Builder must always pass `upcharges` (from `useProductPricing`) and `feeRates` (from `useFeeRates`) into every `calculateQuote` and `calculateLineItemSubtotal` call. Omitting them silently zeroes size upcharges and uses hardcoded fee fallbacks.

---

## Mockup Builder

The Mockup Builder visualizes the job. It is a consumer of Quote Builder data, not a producer of it.

**It owns:**
- Garment templates (visual assets per product type)
- Snap zones and safe area boundaries
- Artwork layer placement (`x`, `y`, `scale`, `rotation` on a `ArtworkLayer`)
- Print boundary definitions
- `computeArtRect` — the single function used for both overlay display and export

**It does NOT own:**
- Quote line item pricing
- Product cost or markup
- Job status

**Key rule — Mockup Builder is NOT gated on the Products catalog.** Any suitable visual representation may be used. The curated Products catalog is an enhancement, never a requirement to create a mockup.

**Entry point:** `components/MockupDesigner.tsx`

**Smart placement:** A client-side adapter maps product type to static placement zones, with an optional DB inch-override gated on `productId`. The `computeArtRect` function is the single source of truth for both the overlay display (with a +30px parent offset) and the export path.

---

## Cost Configuration

Cost Configuration owns all pricing rules. The Quote Builder consumes those rules. Duplication of pricing logic is forbidden.

**What Cost Configuration owns:**
- Size upcharges: stored in `AppSettings` under key `product_pricing`
  - Shape: `{ upcharges: { '2XL': number, '3XL': number, '4XL': number, ... }, overrides: [...] }`
  - Defaults (if no DB row): `2XL: $2, 3XL: $4, 4XL: $6, 5XL: $8, 6XL: $10`
- Fee rates: stored in `AppSettings` under key `taxes_fees`
  - Includes: Online Fee %, Online Fee flat, Card Fee %, Sales Tax %
  - Compile-time fallbacks live in `constants/fees.ts`
- Service Style templates: `defaultMargin`, `defaultProductionDays`, `defaultProductionCosts`

**Client-side access:**
- `useProductPricing()` — hook in `lib/useProductPricing.ts`, fetches `/api/app-settings/product_pricing`
- `useFeeRates()` — hook in `lib/useTaxesFees.ts`, fetches `/api/app-settings/taxes_fees`

**Server-side access (API routes):**
React hooks cannot be used in server-side route handlers. Use the `loadUpcharges()` / `loadFeeRates()` async helper pattern that queries `AppSettings` directly via `pool.query`. See `app/api/portal/[orgId]/projects/[projectId]+api.ts` for the reference implementation.

**Rule:** Never inline pricing rates as magic numbers in a component or API route. All rates come from `AppSettings` with `constants/fees.ts` as the fallback.

---

## Pricing Engine

The pricing engine is the set of functions in `utils/quoteCalculations.ts` that turn raw line item inputs into dollar amounts. It has exactly **five cost buckets**. These names are the source of truth everywhere — in code, in the UI, in PDFs, and in this document.

### The Five Buckets

| Bucket | Field | Definition |
|---|---|---|
| **Product** | `productCostTotal` | Σ (productCostEach × qty) for every configured product, plus size upcharges for 2XL/3XL/4XL |
| **Service** | `serviceCostTotal` | `serviceCostEach × totalQty` — shared decoration service cost per piece |
| **Production** | `productionCostTotal` | Σ itemized `productionCosts[]` rows (Design Fee, Digitizing, Setup, etc.) |
| **Other** | `otherCostTotal` | Σ itemized `otherCharges[]` rows (Rush Fee, Shipping, etc.) |
| **Markup** | `markupTotal` | `markupEach × totalQty` — shared profit margin per piece |

**Derived values (display only, not a sixth bucket):**
- `cogTotal` = Product + Service + Production (the "Production Cost" displayed in the Quote Summary)
- `subtotal` = `cogTotal` + Other + Markup
- `adjustmentBase` = Product + Service + Markup — used as the base for percentage-type adjustments

### Key functions

**`calculateLineItemSubtotal(item, upcharges?)`**
Computes one design's full cost breakdown. Takes an optional `upcharges` map — if omitted, size upcharges are silently $0. Every call site must pass upcharges.

**`calculateLineItemTotals(lineItems, upcharges?)`**
Aggregates `calculateLineItemSubtotal` across all line items.

**`calculateQuote(lineItems, hasOnlineFee, hasSalesTax, hasCardFee, feeRates?, upcharges?)`**
Full quote calculation including fees. Returns `QuoteCalculations | null` (null if no line items or total qty is zero).

**`calcAdjustmentAmount(adj, base)`**
Evaluates a single adjustment row. Handles `flat`, `hourly`, `per_unit`, `percentage` types. Shared by the engine AND the Quote Builder's adjustment tables so the on-screen "Calculated" column always matches.

### Quantity modes

Line items operate in one of two quantity modes, determined by `serviceStyle`:

| Mode | `isPromotional` | Quantity source |
|---|---|---|
| **Garment** (Screen Printing, Embroidery, DTG, etc.) | `false` | `xs + s + m + l + xl + xxl + xxxl + xxxxl` per color variant |
| **Promotional** | `true` | `flat` field only |

Size upcharges apply **only** in garment mode. A line item with stale garment-size quantities that has been switched to Promotional must not produce upcharges — `isPromotional` gates this inside `calculateLineItemSubtotal`.

### Legacy fallback

Line items without itemized `productionCosts[]` or `otherCharges[]` rows fall back to the legacy flat scalar fields (`serviceFeeEach` / `otherCostEach`). New code must write itemized rows; the fallback exists for backwards compatibility with old data only.

---

## Line Item

A Line Item represents one design (decoration + garments) on a quote.

### LineItem owns
- `designName`, `serviceStyle`, `applicator`
- Shared pricing: `markupEach`, `serviceCostEach`
- Itemized production costs: `productionCosts[]` (QuoteAdjustment rows)
- Itemized other charges: `otherCharges[]` (QuoteAdjustment rows)
- Print locations: `location1`, `location2`, `location3`, `location4`, `locationDetails`
- Mockup URI: `mockupUri` (the artwork visualization for the full design)
- The list of configured products: `products[]` (ConfiguredProduct[])
- Legacy flat pricing fields for backwards compatibility: `productCostEach`, `serviceFeeEach`, `otherCostEach`

### LineItem does NOT own
- Per-product cost — that belongs to each ConfiguredProduct
- Per-product color/size breakdown — that belongs to each ConfiguredProduct
- Markup percentage — markup is stored as `markupEach` (dollar per piece); the percentage is derived, not stored

---

## ConfiguredProduct

A ConfiguredProduct is one garment/blank within a design. A design may have multiple configured products (e.g., Adult Tee + Youth Tee + Hoodie in the same Screen Print run).

### ConfiguredProduct owns
- Product identity: `styleNumber`, `styleName`, `brand`, `category`, `productType`, `productLabel`
- Optional catalog link: `productId` (soft reference to the Products catalog — never a hard gate)
- Physical specs: `colorVariants[]` — each variant has a `color` and a `sizes` (SizeQuantities) breakdown
- Sourcing: `vendorName`, `vendorSku`
- Product-specific cost: `productCostEach`

### ConfiguredProduct does NOT own
- Markup — owned by the parent LineItem
- Service cost — owned by the parent LineItem
- Print locations — owned by the parent LineItem
- Mockup — owned by the parent LineItem

### Canonical read function

Always use `getLineItemProducts(item)` from `utils/configuredProduct.ts` to read a line item's products. This handles both the `products[]` array and the legacy `configuredProduct` single-product field. Never access `item.products` or `item.configuredProduct` directly in calculation or display code.

---

## Data Ownership

### Quote
Owns the **financial snapshot** at a point in time.
- `status`, `versionNumber`, `subtotal`, `taxAmount`, `total`
- References a `Project`; contains `QuoteLineItem[]`
- Used for PDF generation and client-facing quote delivery

### Project
The **central container** for a job. The primary operational entity.
- `title`, `projectNumber`, `status`, `priority` (RUSH → High → Standard)
- Dates: `orderDate`, `inHandsDate`, `dueDate`
- `lineItemsData` (JSON) — the live line items, synced from quote
- `calculations` (JSON) — the stored calculation result; always re-computed from `lineItemsData`, never trusted as the source of truth for display (recompute from lineItemsData + upcharges)
- Relations: `organizationId`, `primaryContactId`, `salesRepId`
- Owns `File[]`, `Activity[]`, `Invoice[]`

### Organization
Owns **account-level identity**.
- `name`, billing/shipping addresses, `phone`, `taxExempt`
- `hubEnabled` — whether the Client Hub portal is active for this org
- `logoUrl` — **single source of truth** for the org logo everywhere in the app
- Parent to `Contact[]`, `Project[]`, `File[]`

### Contact
Owns **individual person identity**.
- `firstName`, `lastName`, `email`, `phone`, `role`
- Optional `linkedUserId` — the FK to a `User` record for hub login access
- Hub portal access is derived from `linkedUserId`, **never from email matching**
- Belongs to one `Organization`

### Product (Catalog)
Owns **master reference data** for the curated garment library.
- `styleNumber`, `brand`, `category`, `defaultBlankCost`
- Read-only template. Does not gate quoting or mockups.
- `ConfiguredProduct.productId` is a soft, optional link — a snapshot enhancement, never a requirement.

### ServiceStyle
Owns **process templates**.
- `name`, `defaultMargin`, `defaultProductionDays`
- `defaultProductionCosts` — seed data for new line items

### Location (Print Location)
- As a `LineItem` field: stored as strings (`location1`–`location4`, `locationDetails`)
- As a `ProductPlacement`: stores `x`, `y`, `width`, `height` coordinates on a garment template

### File
- `storageKey`, `originalName`, `mimeType`, `fileSize`
- `fileType` enum: `ARTWORK`, `PROOF`, `MOCKUP`, `INVOICE`, `OTHER`
- `visibility`: `INTERNAL` (shop-only) or `CLIENT_VISIBLE` (appears in portal)
- Belongs to an `Organization` and optionally a `Project`
- R2 storage: enabled via `STORAGE_PROVIDER=r2`; dev container cannot reach R2 (TLS blocked by Cloudflare) — test via deployed env only

### Mockup
Stored as a `File` with `fileType: MOCKUP`. The URI is stored on the `LineItem` as `mockupUri`. In the Mockup Designer, artwork state is represented as `ArtworkLayer[]` (client-side only, not persisted to DB directly).

---

## Settings

| Settings page | Owns |
|---|---|
| **Product Pricing** | Size upcharges (`AppSettings.product_pricing`) |
| **Taxes & Fees** | Online Fee %, Card Fee %, Sales Tax % (`AppSettings.taxes_fees`) |
| **Company** | Business name, address, logo (`AppSettings.company_info`) |
| **Users** | User list; role assignment (`org_admin` / `user`) |
| **Integrations** | Third-party API keys (stored as secrets, never in `AppSettings`) |

`AppSettings` is a key-value table (`key TEXT, value JSONB`). All settings keys are lowercase snake_case strings. Server-side access is via `pool.query('SELECT value FROM "AppSettings" WHERE key = $1', [key])`.

---

## Approved Terminology

Terminology consistency is part of the application's architecture. These names are the authoritative labels used in the UI, in code identifiers, in this documentation, and in all future prompts and task descriptions. Never invent alternative names for these concepts. If a concept needs to be renamed, update this document, the UI labels, and all code references in a single coordinated task.

### Module and Page Names

| Approved name | Definition |
|---|---|
| **Quote Builder** | The tool for creating and editing a job's line items, pricing, and quantities. Entry: `app/(tabs)/index.tsx`, `app/quote/edit.tsx` |
| **Mockup Builder** | The tool for placing artwork on garment templates. Separate from Quote Builder. Entry: `components/MockupDesigner.tsx` |
| **Client Hub** | The customer-facing portal accessible at `/portal/[orgId]`. Not "customer portal" or "client portal" — "Client Hub". |
| **Organization Settings** | The settings page for org-level configuration. Not "Account Settings" or "Company Settings". |
| **Cost Configuration** | The umbrella term for all pricing rules managed in Settings. Not "pricing settings" or "rate configuration". |
| **Production Library** | The saved library of itemized Production Cost rows available to the Quote Builder. Not "production cost presets". |
| **Other Charges Library** | The saved library of itemized Other Charge rows available to the Quote Builder. Not "other cost presets". |
| **Service Styles** | The list of decoration methods (Screen Printing, Embroidery, DTG, Promotional, etc.). Not "service types" or "decoration types". |
| **Taxes & Fees** | The Settings page and AppSettings key for Online Fee %, Card Fee %, and Sales Tax %. Not "fee settings" or "tax configuration". |
| **Product Pricing** | The Settings page and AppSettings key for size upcharges. Not "size fees" or "upcharge settings". |

### Data Model Terms

| Approved name | Definition |
|---|---|
| **Line Item** | One design (decoration + products) on a quote. Corresponds to a `LineItem` object. Not "design row" or "quote item". |
| **Line Item Costs** | The detailed cost breakdown panel for a single Line Item showing all five buckets. Not "item breakdown" or "cost details". |
| **Line Item Subtotal** | The dollar total for a single Line Item = cogTotal + Other + Markup. Not "item total" or "design cost". |
| **Quote Summary** | The aggregate panel (`CalculationDisplay`) showing rolled-up totals across all Line Items. Not "quote totals" or "pricing summary". |
| **Production Cost** | The third pricing bucket — itemized setup/production fees (Design Fee, Digitizing, etc.). Not "service fee" or "setup cost". |
| **Other Charge** | The fourth pricing bucket — indirect costs (Rush, Shipping, etc.). Not "miscellaneous" or "additional fees". |

### The Five Pricing Bucket Names (Exact)

These five names must be used verbatim everywhere — in the UI, in PDF templates, in code variable names, in test descriptions, and in this documentation:

| # | Name | Code field |
|---|---|---|
| 1 | **Product** | `productCostTotal` |
| 2 | **Service** | `serviceCostTotal` |
| 3 | **Production** | `productionCostTotal` |
| 4 | **Other** | `otherCostTotal` |
| 5 | **Markup** | `markupTotal` |

The aggregate of buckets 1–3 is called **Production Cost** (displayed as "Production Cost" in the Quote Summary). The aggregate of all five buckets minus fees is called the **Subtotal**.

---

## Forbidden Patterns

These patterns are explicitly banned. Any PR introducing them must be reverted:

| Pattern | Why it's banned |
|---|---|
| `position: 'absolute'` sibling dropdown | Clips inside ScrollViews. Use `<OverlayMenu>` (Modal portal) instead. |
| Raw `.phone` render without `formatPhone()` | Violates Phone Format Law — all phones must be `(###) ###-####` |
| `calculateLineItemSubtotal(item)` without upcharges at a new call site | Silently zeroes 2XL/3XL/4XL upcharges |
| React hook inside a server-side API route | Hooks are runtime React — they do not execute in Node/Bun server handlers |
| `= $1::uuid` in raw SQL for a Prisma String @id | Prisma maps `String @id @default(uuid())` to PostgreSQL `text`, not `uuid`. The cast fails. Use `= $1`. |
| `prisma db push --accept-data-loss` for additive column changes | Can drop unrelated drifted columns. Use a targeted `ALTER TABLE ADD COLUMN` instead. |
| Gating quoting or mockups on the Products catalog | Products = curated library, not the universe. Quoting is always free-text. |
| Putting markup or service cost on a `ConfiguredProduct` | Both are owned by the parent `LineItem`. |
| New global visual transforms in a `useEffect` | Must go in the SSR `<head>` via `+html.tsx` to avoid first-paint flash. |
| Email CTA URLs without `https://` prefix | `REPLIT_DEV_DOMAIN` is a bare host; mail clients treat it as a relative URL. |

---

## Future Architecture

### Production Module
The Production tab is a **lens** over operational projects — not a separate data store. It filters Projects by production-relevant statuses (`ACTIVE`, `IN_PRODUCTION`). No separate production table should be created. Production state lives on `Project`.

Expected integrations:
- **Scheduling:** A production calendar view driven by `Project.inHandsDate` and `Project.dueDate`
- **Inventory:** Link `ConfiguredProduct.vendorSku` to inventory counts; surface low-stock warnings in the Quote Builder

### Accounting Integration
- Invoices are generated from Project data and stored as `Invoice` records
- Expected: export-to-QuickBooks or Xero via their APIs, not a DB sync
- `Invoice.invoiceNumber` format: `INV-YYMMDD-NNN`

### Reporting
- Current: CSV and Google Sheets exports from `app/api/reports/`
- Expected: A reporting dashboard aggregating quote value by org, rep, and service style
- All report queries should read from the `Project` and `Quote` tables — not from `calculations` JSON (too denormalized for aggregation)

### Multi-Location / Multi-Shop
- `Organization.hubEnabled` is per-org; each org gets its own Client Hub subdomain at `/portal/[orgId]`
- Future: per-org pricing overrides in `AppSettings` (currently global)
