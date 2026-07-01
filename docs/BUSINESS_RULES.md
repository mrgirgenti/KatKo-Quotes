# Business Rules

## Purpose

This document is the authoritative source for how the **Katalyst Ko Quote Tracker 5000** behaves as a business application. It contains business logic only — not implementation details, not code references, not database schemas.

When a developer or AI agent needs to understand *why* the application works a certain way, this document provides the answer. When a new feature is being designed, this document defines the constraints it must operate within.

Rules in this document are not implementation suggestions. They are the established behavior of the application. Any change to a business rule requires an explicit decision and an update to this document.

---

## Quotes

### What a Quote Is
- A Quote is a formal offer of price for a job.
- A Quote belongs to a Project. A Project may have multiple Quotes (versioned), but only one active Quote at a time.
- A Quote is not a Project. The Project tracks the lifecycle of the job; the Quote tracks the financial offer at a specific point in time.

### Quote Structure
- A Quote contains one or more **Line Items**.
- Every Line Item represents one design — a single decoration applied to one or more products.
- A Quote with zero Line Items cannot be calculated and cannot be sent.
- A Quote with zero total quantity cannot be calculated.

### Quote Lifecycle
- **Draft** — being built; not yet sent to the client.
- **Quote Sent** — the formal offer has been delivered to the client. The Quote is locked from further edits unless explicitly revised.
- **Active** — the client has accepted; the job is in progress.
- **In Production** — garments are being decorated.
- **Completed** — the job has been fulfilled.
- **Cancelled** — the job was abandoned.
- **Expired** — a Quote Sent that received no response within the expiration window.

### Quote Validity
- The Quote price shown to the client is the price at the time it was sent. Changes to pricing rules (upcharges, fee rates) after a Quote is sent do not retroactively change that Quote's total.
- Recalculation from stored `lineItemsData` JSON always uses the current pricing rules. Stored `calculations` JSON is a cache, not a contract.

---

## Line Items

### What a Line Item Is
- A Line Item is one design applied to one or more products.
- A Line Item is the smallest unit of pricing in a Quote.
- A Line Item has exactly one Service Style.
- A Line Item may contain multiple configured products (e.g., Adult Tee + Youth Tee in the same Screen Print run).

### Line Item Costs
- Every Line Item is priced using exactly five cost buckets: **Product**, **Service**, **Production**, **Other**, **Markup**.
- These five names are the only names used for these concepts anywhere in the application.
- Buckets 1–3 (Product + Service + Production) together form the **Production Cost** — the internal cost of fulfilling the job.
- The Line Item **Subtotal** = Production Cost + Other + Markup.
- The Subtotal is the amount the client is quoted for that line item before quote-level fees (Online Fee, Card Fee, Sales Tax).

### Line Item Quantities
- A Line Item operates in one of two quantity modes, determined by its Service Style:
  - **Garment mode** (Screen Printing, Embroidery, DTG, Heat Transfer, etc.) — quantity is the sum of individual garment sizes (XS, S, M, L, XL, 2XL, 3XL, 4XL).
  - **Promotional mode** — quantity is a single flat count. Garment sizes do not apply.
- Size upcharges (for 2XL, 3XL, 4XL) apply **only** in garment mode. They never apply in promotional mode.
- If a Line Item is switched from garment mode to promotional mode, any garment-size quantities stored on the item must not produce size upcharges.

---

## Products

### The Product Catalog Is a Curated Library
- The Products catalog is a deliberately curated library of reference garments — not a closed list of every product that can ever be quoted.
- **Quoting is never restricted to the Products catalog.** Any product can be quoted using free-text fields.
- The Products catalog exists as an optional enhancement: it can pre-fill cost, style number, and vendor data when a matching garment is found.
- A Quote Line Item links to a Product catalog entry via a soft, optional reference. That link is never required to create or save a quote.

### Configured Products
- A Configured Product is a specific garment choice within a Line Item — a particular style, in one or more colors, across a size run.
- A Configured Product may link to the Products catalog (for data enrichment), but does not require it.
- Multiple Configured Products in the same Line Item share the same Service Style, print locations, and markup. Their product costs are calculated independently.

### Product Cost
- The Product cost is the blank garment cost — what the shop pays for the physical item before decoration.
- Product cost is per piece, not per line. Each Configured Product has its own `productCostEach`.
- Size upcharges are added to the Product cost bucket, not tracked as separate line items.

---

## Pricing

### Pricing Rules Are Global Settings
- All pricing rules (upcharge rates, fee rates) are stored as global application settings.
- Individual quotes and projects do not store their own pricing rules — they are calculated from the global settings at the time of calculation.
- Exception: A sent Quote's stored `calculations` JSON represents the totals at the time of sending. The live recalculation may differ if settings have changed since then.

### Size Upcharges
- The shop charges extra for oversized garments: 2XL, 3XL, 4XL (and optionally 5XL, 6XL).
- Upcharge rates are configured in **Product Pricing** (a Settings page).
- Default rates when no configuration is saved: 2XL +$2, 3XL +$4, 4XL +$6, 5XL +$8, 6XL +$10 per piece.
- Upcharges are added to the **Product** cost bucket of the affected Line Item.
- Upcharges are per piece and multiply by the quantity of oversized garments in that size.
- Upcharges apply to every call site that calculates line item subtotals — Quote Builder, CalculationDisplay panel, portal DTO, PDFs, and invoices.

### Service Style Determines Quantity Mode
- The Service Style on a Line Item determines whether the job is priced in garment mode or promotional mode.
- Promotional items use a flat quantity; garment items use the size breakdown.
- Switching a Line Item's Service Style changes the active quantity field. The inactive field's data is preserved but must not contribute to totals.

### Fee Structure
- **Online Fee** — a percentage + flat fee charged for portal-submitted orders.
- **Card Fee** — a percentage charged when the client pays by card.
- **Sales Tax** — a percentage charged to taxable clients.
- These three fees are applied at the Quote level (not the Line Item level) against the Quote subtotal.
- Each fee is a separate, named line in the Quote Summary and in customer-facing documents. They are never combined into a single "Processing & Handling" line.

### Production Costs
- Production Costs are directly related to production: Design Fee, Digitizing Fee, Screen Setup, etc.
- They are itemized rows within a Line Item, not a flat field.
- Production Costs contribute to the internal **Production Cost** base (buckets 1–3) and affect the markup percentage calculation.
- The **Production Library** is a shop-maintained list of commonly used Production Cost rows, available as quick-adds in the Quote Builder.

### Other Charges
- Other Charges are indirect costs associated with completing the order: Rush Fee, Shipping, Storage, etc.
- They are itemized rows within a Line Item, not a flat field.
- Other Charges are added to the Subtotal but are **not** included in the Production Cost base. They do not affect the markup percentage calculation.
- The **Other Charges Library** is a shop-maintained list of commonly used Other Charge rows, available as quick-adds in the Quote Builder.

### Markup
- Markup is the shop's profit margin on a Line Item.
- Markup is expressed as a per-piece dollar amount (`markupEach`) and applied across the total quantity.
- The markup percentage displayed in the Quote Summary is calculated over the Production Cost base (Product + Service + Production) — not over the full subtotal including Other Charges.
- Markup is shared across all Configured Products in the same Line Item. It does not vary by product within a Line Item.

---

## Mockups

### Mockup Builder Is Separate from Quote Builder
- The Mockup Builder is a visualization tool. It consumes data from the Quote Builder — it does not produce pricing data.
- Mockups never own quote pricing. A mockup is a visual representation of artwork placement, not a cost document.
- The Mockup Builder can be used with any suitable visual representation — it is not limited to products in the curated catalog.

### Artwork Placement
- Print locations defined in the Quote Builder (Left Chest, Full Back, etc.) become the artwork placement zones in the Mockup Builder.
- Placement coordinates (x, y, scale) are stored on the Line Item, not on the Configured Product.
- One mockup URI is stored per Line Item — it represents the artwork applied to the whole design, not to each individual product variant.

### Mockup Visibility
- Mockup files are stored with visibility settings. By default, mockups are internal.
- Only files explicitly marked `CLIENT_VISIBLE` appear in the Client Hub portal.

---

## Client Hub (Customer Portal)

### What the Client Hub Is
- The Client Hub is a branded, per-organization portal where clients can review their project status, submitted quotes, invoices, and files.
- Each Organization has its own Client Hub, accessed at `/portal/[orgId]`.
- The Client Hub is **not** authenticated via Clerk. It uses a separate, simpler email-based or link-based access system.
- Hub access is enabled per Organization via the `hubEnabled` toggle.

### What Clients Can See
- Project status and order details (sanitized — no cost, markup, or COGS data).
- Customer-facing pricing (the per-piece and line total the client pays).
- Files marked `CLIENT_VISIBLE`.
- Invoices that are not in Draft status.
- Quote approval/decline actions.

### What Clients Cannot See
- Product cost, service cost, markup, COGS, or any internal financial breakdown.
- Sourcing data (vendor names, vendor SKUs, applicator).
- Internal files.
- Draft invoices.

### Hub Provisioning
- Hub access for a client is linked to a Contact record via `Contact.linkedUserId`.
- Access is never derived from email matching alone — it requires the explicit `linkedUserId` link.
- One write path manages all hub provisioning changes.

---

## Organizations and Contacts

### Organizations
- An Organization represents a business account — a client company.
- All projects, quotes, contacts, and files belong to an Organization.
- An Organization may have multiple Contacts.

### Contacts
- A Contact is a specific person at an Organization.
- Contacts are the single source of truth for individual people.
- A Contact may be linked to a User account (for hub access) via `linkedUserId`.
- One Contact may be the primary contact on a Project.

### Phone Numbers
- Every phone number stored in the application must be formatted as `(###) ###-####`.
- This applies to display, storage, inputs, PDFs, portal, and exports.
- Non-US / non-10-digit numbers pass through unformatted rather than being blocked.

---

## Settings

### Product Pricing
- Owns size upcharge rates (2XL–6XL dollar amounts per piece).
- Applies globally to all quotes and projects.
- Changing these rates does not retroactively change sent quotes.

### Production Library
- A curated list of commonly used Production Cost rows.
- Available as quick-adds in the Quote Builder's Production Costs panel.
- Editing the library does not change already-saved Line Items.

### Other Charges Library
- A curated list of commonly used Other Charge rows.
- Available as quick-adds in the Quote Builder's Other Charges panel.
- Same rules as Production Library — library edits do not affect saved Line Items.

### Service Styles
- The list of available decoration methods shown in the Quote Builder's Service Style selector.
- Each Service Style may define a default margin, default production days, and default Production Cost rows that pre-populate a new Line Item.
- Service Styles determine quantity mode (garment vs. promotional).

### Taxes & Fees
- Owns Online Fee percentage, Online Fee flat amount, Card Fee percentage, and Sales Tax percentage.
- These rates apply at the Quote level when the corresponding toggle is enabled on a Quote.
- Each fee appears as a separate, named line in customer-facing documents.

---

## Files and Media

### File Ownership
- Files may belong to an Organization and optionally to a specific Project.
- Project files are always also scoped to their parent Organization.

### File Visibility
- `INTERNAL` — visible only to shop staff. Default for all newly uploaded files.
- `CLIENT_VISIBLE` — visible in the Client Hub to the client. Must be set explicitly.
- Artwork and proofs default to `INTERNAL`. Approved proofs may be promoted to `CLIENT_VISIBLE`.

### Mockup Files
- Mockup files are stored as Files with a `MOCKUP` file type.
- The mockup URI on a Line Item points to the stored mockup file.

---

## General Business Rules

These rules capture important decisions made throughout development. They exist here so they are not lost in implementation prompts or conversation history.

### The Five Pricing Buckets Are Fixed
The five-bucket model (Product / Service / Production / Other / Markup) is the permanent pricing architecture. No new buckets are added without an explicit architectural decision. No two buckets are merged. The names are fixed — see Approved Terminology in `ARCHITECTURE_PRINCIPLES.md`.

### Quoting Is Never Gated on the Product Catalog
Any product can be quoted. The Products catalog is a convenience layer, never a gate. A quote with no catalog-linked products is valid and must calculate correctly.

### Portal Totals Must Match Quote Builder Totals
The customer-facing price shown in the Client Hub must equal the price the shop computed in the Quote Builder for the same Line Item and settings. If they diverge, the portal is wrong. The Quote Builder is the source of truth.

### Sent Quote Totals Are Immutable
Once a Quote is sent, its stored calculations represent the offer. Recalculation with newer settings may produce a different number, but the stored total is the amount the client was quoted. A revision must be issued as a new Quote version.

### Service Style Switches Must Not Corrupt Quantities
When a Line Item's Service Style is changed, the inactive quantity field's data is preserved in storage but must not contribute to totals. Garment sizes must not produce upcharges in promotional mode. Flat quantity must not be used as a garment count.

### Size Upcharges Must Reach Every Calculation Surface
Upcharges must be passed to every call of `calculateLineItemSubtotal`. A call site that omits upcharges silently produces wrong totals for any Line Item with 2XL/3XL/4XL quantities. This is a correctness requirement, not an optimization.

### Fees Are Always Itemized Separately
Online Fee, Card Fee, and Sales Tax are always shown as separate named line items. They are never combined. This applies to the Quote Summary panel, PDFs, invoices, and the Client Hub.

### Internal Costs Never Leave the Server on Portal Routes
Portal API routes must never expose product cost, service cost, markup amount or percentage, COGS, or sourcing data (vendor, applicator) to the client. These fields must be stripped at the server before the response is sent.

### Clerk Authentication Is Frozen
Clerk is the authentication system and it is complete. No changes to authentication, session handling, or user management are made unless explicitly requested. This rule supersedes any refactoring or cleanup instinct.
