# Implementation Definition of Done

## Purpose

This document defines what it means for a feature in the **Katalyst Ko Quote Tracker 5000** to be considered complete. It exists to prevent partial implementations from being shipped — features that work in one surface but silently produce wrong data, broken UIs, or stale values in another.

Every implementation task must be evaluated against this document before it is marked done. If a checklist item cannot be evaluated, that must be explicitly noted as out of scope with a reason.

---

## Feature Planning

Before writing a single line of code, answer all of the following:

**1. What is the business problem?**
State the real-world outcome. Not "add a field to the database" but "prevent shop staff from quoting an order without a cost-per-piece."

**2. What systems are affected?**
Walk the full data flow. A pricing change touches the Quote Builder, the Pricing Engine, CalculationDisplay, LineItemCard, the portal DTO sanitizer, PDFs, and tests. Identify every node before you start.

**3. Who owns the data?**
Refer to the Data Ownership section in `ARCHITECTURE_PRINCIPLES.md`. Do not add a field to the wrong entity. Do not let a child own data that belongs to a parent.

**4. What are the persistence requirements?**
Will this data need to survive a page reload? Be queried? Be migrated? See the Persistence Checklist below.

---

## System Impact Review

Every implementation must evaluate the systems listed below. Check each one that is relevant to the change being made. Irrelevant systems must be explicitly skipped, not silently ignored.

### Quote Builder
- [ ] New fields render correctly in the Quote Builder form (`app/(tabs)/index.tsx`, `app/quote/edit.tsx`)
- [ ] LineItemCard reflects the change (`components/LineItemCard.tsx`)
- [ ] CalculationDisplay reflects the change (`components/CalculationDisplay.tsx`) — and receives any new upcharges/fee props it needs

### Pricing Engine
- [ ] `calculateLineItemSubtotal` in `utils/quoteCalculations.ts` is updated if any cost bucket changes
- [ ] `calculateQuote` aggregate is still correct
- [ ] Upcharges (`useProductPricing`) are threaded to every `calculateLineItemSubtotal` call site
- [ ] Fee rates (`useFeeRates`) are threaded to every `calculateQuote` call site
- [ ] The five-bucket model (Product / Service / Production / Other / Markup) is preserved — no new buckets, no merging of existing ones

### Cost Configuration
- [ ] Any new pricing rule lives in `AppSettings` (queried via `/api/app-settings/[key]+api.ts`), not hardcoded in a component
- [ ] Server-side API routes that recompute pricing use `loadUpcharges()` / `loadFeeRates()` patterns (never React hooks)
- [ ] Defaults in `constants/fees.ts` are updated if the compile-time fallbacks change

### Customer Portal
- [ ] The portal DTO sanitizer (`app/api/portal/[orgId]/projects/[projectId]+api.ts`) correctly computes `customerUnitPrice` and `customerLineTotal` with upcharges
- [ ] No internal financial data (cost, markup, COGS, sourcing) is included in the portal response — whitelist only
- [ ] Portal UI (`app/portal/[orgId].tsx`) renders the new/changed data correctly
- [ ] Unauthenticated access is preserved — portal routes must not require Clerk tokens

### Mockup Builder
- [ ] Mockup Designer (`components/MockupDesigner.tsx`) receives updated line item data if product/location data changed
- [ ] Smart placement zones are respected — do not hardcode art positions
- [ ] Artwork layers are stored on the LineItem, not on the ConfiguredProduct

### Production Sheets
- [ ] Production Punch Sheet template reflects any new fields
- [ ] `computeArtRect` export path is unchanged if layout changes

### Invoices
- [ ] Invoice line items reflect the updated pricing
- [ ] Invoice total matches the Quote total for the same set of line items

### PDFs
- [ ] PDF templates (Quote, Invoice, Production) use `KO_LOGO_HORIZONTAL_URI` from `constants/logoDataUri.ts` — never a network URL
- [ ] PDF totals match the in-app calculations (same five-bucket model)

### Reporting
- [ ] Any new status, field, or entity is included in CSV/Sheet exports if it is user-visible data
- [ ] Report queries in `app/api/reports/` are updated

### API
- [ ] New or changed data is exposed via an API route in `app/api/`
- [ ] Dynamic route handlers guard against `null` params (Expo Router SSR can call routes with null during static render)
- [ ] Write paths normalize phone numbers via `formatPhoneOrNull` before storing
- [ ] All `fetch()` calls to authenticated routes include `Authorization: Bearer <getClerkToken()>`

### Database
- [ ] `prisma/schema.prisma` is updated for any schema change
- [ ] A targeted `ALTER TABLE` (not `prisma db push --accept-data-loss`) is run for additive column additions
- [ ] Actual column existence is verified via `information_schema` before writing raw SQL that references new columns
- [ ] The `lib/pool.ts` raw SQL uses `= $1` (text comparison), never `= $1::uuid` (breaks on Prisma `String @id @default(uuid())` which maps to `text`, not `uuid`)

### Authentication
- [ ] Clerk is complete and frozen. Do not touch auth unless explicitly requested.
- [ ] `isAdmin` checks account for the async `currentUser=null` initialization state

### Notifications
- [ ] If the change triggers a user-facing notification, the email CTA URL is prefixed with `https://` (bare `REPLIT_DEV_DOMAIN` breaks mail clients)

### File Storage
- [ ] Files uploaded via the portal use portal-specific routes (no Clerk token available)
- [ ] All `fetch()` calls to `/api/files` include `Authorization: Bearer <getClerkToken()>`
- [ ] File visibility (`INTERNAL` vs `CLIENT_VISIBLE`) is set correctly for the file type

### Organization Settings
- [ ] `Organization.logoUrl` remains the single source of truth for org logos everywhere
- [ ] Role-based access (`org_admin` vs `user`) is respected for any new settings surface

### Client Hub
- [ ] Hub access is derived from `Contact.linkedUserId` — never from email matching
- [ ] Hub provisioning write path uses the one contact-keyed write path in `lib/contacts`
- [ ] Portal login is separate from Clerk auth

---

## Persistence Checklist

For any data that is created or modified, verify all applicable operations:

| Operation | Verified |
|---|---|
| **Create** — new record saves correctly to DB | |
| **Read** — record loads correctly on page reload | |
| **Update** — edits persist and do not corrupt adjacent fields | |
| **Delete** — record is removed and all FK references are cleaned up | |
| **Save** — in-progress state (e.g. quote draft) survives a tab refresh | |
| **Reload from DB** — calculations rehydrate correctly from stored JSON (no drift on `serviceStyle` reload) | |
| **Migration** — schema change is applied with a targeted `ALTER TABLE`, not a destructive `db push` | |
| **Backwards compatibility** — existing records without the new field do not 500 or render broken | |

---

## Pricing Checklist

Any change that touches cost, price, markup, fee, or upcharge must verify the full chain:

| Surface | Verified |
|---|---|
| **Product bucket** — `productCostEach × qty + sizeUpcharges` | |
| **Service bucket** — `serviceCostEach × qty` | |
| **Production bucket** — Σ itemized `productionCosts` rows (or legacy `serviceFeeEach` fallback) | |
| **Other bucket** — Σ itemized `otherCharges` rows (or legacy `otherCostEach` fallback) | |
| **Markup bucket** — `markupEach × qty` | |
| **Line Item Subtotal** — `cogTotal + otherCostTotal + markupTotal` | |
| **Quote Summary** (`CalculationDisplay`) — upcharges prop passed, totals match LineItemCard | |
| **Customer Portal** — `customerUnitPrice` / `customerLineTotal` computed with upcharges server-side | |
| **APIs** — `/api/quotes/`, `/api/projects/` return correct totals | |
| **Database** — stored `calculations` JSON matches recalculated value | |
| **Tests** — `tests/pricing-drift.test.ts` and `tests/upcharge-regression.test.ts` still pass | |

---

## UI Checklist

Refer to `UI_DESIGN_SYSTEM.md` for exact values. Verify:

| Item | Verified |
|---|---|
| Colors use `Colors.light.*` tokens — no hex literals in component StyleSheets | |
| Typography sizes and weights match the design system (`DS.font.*`) | |
| Spacing uses `DS.spacing.*` values — no magic numbers | |
| Border radius uses `DS.radius.*` values | |
| Every dropdown / context menu uses `<OverlayMenu>` — never `position: 'absolute'` siblings | |
| Phone numbers displayed through `formatPhone()`, inputs through `formatPhoneInput()`, writes through `formatPhoneOrNull()` | |
| Responsive: all operational tables (Quotes, Projects, Orgs, Contacts) render the full desktop table in a horizontal `ScrollView` at every breakpoint | |
| New UI does not introduce a post-hydration `useEffect` for global visual transforms (causes SSR flash) | |
| `MediaCard` `typeLabel` is populated on every usage | |

---

## Testing Requirements

Use this matrix to determine what to add:

| Scenario | Test type required |
|---|---|
| New pricing calculation or upcharge path | Unit test in `tests/` (Bun test) |
| Change to `calculateLineItemSubtotal` or `calculateQuote` | Update `__tests__/pricing.test.ts` + `tests/pricing-drift.test.ts` |
| Size upcharge threading to a new call site | Add case to `tests/upcharge-regression.test.ts` |
| `serviceStyle` switch that changes quantity mode | Regression test in `tests/pricing-drift.test.ts` |
| New API route or changed DTO shape | Verify manually; document shape in the route file |
| Breaking change to a shared utility (`getLineItemProducts`, `syncLineItemFromProducts`, etc.) | Unit test covering the old and new behavior |

Run the full suite before marking done:
```
bun test tests/ __tests__/
```
All tests must pass (0 failures).

---

## Architecture Review

Before shipping, answer:

1. **Is this duplicated?** Does an equivalent utility, component, or hook already exist? (`getLineItemProducts`, `useProductPricing`, `useBreakpoint`, `OverlayMenu`, etc.)
2. **Can this reuse an existing component?** Check `components/` before creating new ones.
3. **Does this violate any architecture principle?** See `ARCHITECTURE_PRINCIPLES.md`. Common violations:
   - Putting markup or service cost on a `ConfiguredProduct`
   - Gating quoting or mockup generation on the Products catalog
   - Using a React hook in a server-side API route
   - Rendering a raw `.phone` field without `formatPhone()`
   - Using `position: 'absolute'` for a dropdown instead of `<OverlayMenu>`

---

## Cross-Module Verification

Every feature that touches pricing must be traced through the full consumer chain. Use this as a starting template — add or remove nodes for the specific change:

```
AppSettings (upcharges / fee rates)
        ↓
Cost Configuration UI (Settings → Product Pricing / Taxes & Fees)
        ↓
useProductPricing / useFeeRates  (React hooks, client-side)
loadUpcharges / loadFeeRates     (server-side, API routes)
        ↓
calculateLineItemSubtotal(item, upcharges)
        ↓
calculateQuote(lineItems, ..., feeRates, upcharges)
        ↓
┌────────────────────────────────────────────┐
│ LineItemCard (Quote Builder)               │  ← passes upcharges
│ CalculationDisplay (Quote Builder summary) │  ← must receive upcharges prop
│ Portal API DTO sanitizer                   │  ← loadUpcharges() server-side
│ PDF / Invoice templates                    │  ← recompute or use stored calculations
│ Reports API                                │  ← query stored calculations JSON
└────────────────────────────────────────────┘
        ↓
Tests (pricing-drift, upcharge-regression, pricing unit tests)
```

If you add a new call site for `calculateLineItemSubtotal`, it **must** appear in this chain.

---

## Required Deliverable

Every implementation task must close with a summary listing:

| Item | Detail |
|---|---|
| **Files modified** | List every file touched |
| **Components modified** | List UI components with a one-line description of the change |
| **Database changes** | Schema change + migration SQL run (or "none") |
| **API changes** | New or changed routes and their input/output shape |
| **Tests added** | File and describe block name for every new test |
| **Remaining work** | Explicitly state any known gaps or deferred items |

A task with no remaining work and all checklists verified is done. A task with unchecked items that were not explicitly scoped out is not done.
