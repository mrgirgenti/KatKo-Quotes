---
name: Products is a curated catalog, not the product universe
description: Quoting/mockups are intentionally decoupled from the Products table; Products must enhance quoting, never gate it.
---

# Products is a curated catalog, NOT the complete product universe

**Stated owner decision:** The `Product` catalog represents only curated / preferred / frequently-quoted / mockup-ready products with maintained costs/assets/templates. Quotes and mockups must support three product kinds: (1) Catalog products, (2) Manual free-text products typed during quoting, (3) Future API products (S&S, SanMar, etc.). Products should ENHANCE quoting, never RESTRICT it.

**Current reality (verified):** quoting & mockups are already fully decoupled from Products.
- Quote line items store `product` / `productColor` / `apparelProvider` as FREE-TEXT strings (`types/quote.ts` `LineItem`). Persisted as JSON in `Project.lineItemsData` and mirrored to `ProjectItem` (`catalogStyle`, `color`, `vendor`, `garmentType` — all nullable text). No `productId` FK anywhere in quote/project/invoice models. `ComboBox` already offers "Enter custom value…".
- MockupDesigner is self-contained: hardcoded `VENDOR_CATALOG` (vendorCatalog.ts) + SVG garments/zones (garmentData.ts). Supports "Custom Style". Never touches the Products tables. Mockups attach to line items by `mockupUri` string only.

**There are ~5 disconnected sources of "product/vendor" truth:** (1) hardcoded `PRODUCTS`/`PRODUCT_COLORS`/`APPAREL_PROVIDERS`/`VENDORS` in `types/quote.ts`; (2) hardcoded `VENDOR_CATALOG`+garmentData in MockupDesigner; (3) Product catalog tables; (4) `Vendor` table (sourcing); (5) `ClientCatalog` table (Catalogs tab). They drift (e.g. "SS Activewear"/"San Mar" vs "S&S Activewear"/"SanMar" vs duplicate "S+S Activewear").

**Why it matters / how to apply (the trap to avoid at integration time):** the natural-but-wrong implementation is to bind the quote product field to `/api/products` as a hard dependency (required selection, FK, server validation that rejects unknown styles). That silently re-introduces "must exist in Products" and breaks manual + API products. Safeguards: keep any catalog link OPTIONAL/soft (nullable `catalogProductId`, never FK/Restrict); model line-item source as `catalog|manual|api`; SNAPSHOT catalog fields (style/brand/cost/template) onto the line item at quote time so edits/deletes to the catalog never alter historical quotes; drive vendor dropdowns from the approved active `Vendor` table while always preserving free-text manual entry; product matching is non-blocking (attach soft link if found, otherwise still save).
