---
name: Vendor source model
description: Vendor + ProductVendor tables for supply chain — separate from Product.vendor (manufacturer label)
---

## The rule
`Product.vendor` = manufacturer/brand label (same as `brand` for all current products). Supply chain vendors live in `ProductVendor` table. Never merge these concepts.

**Why:** Products are manufacturer styles (NL6210 = Next Level style). Vendors are distributors (S&S Activewear, SanMar, AlphaBroder) who sell the same style. One product → many vendor sources.

**How to apply:** When quoting needs blank garment cost → select `ProductVendor` record, not `Product.vendor`. Future quote line item stores `productVendorId`.

## Seeding
- 7 vendors: S&S Activewear (preferred for all), SanMar (secondary all), AlphaBroder (Gildan+BC only), McCreary's, Hit Promotional, Starline, Other
- 21 source records for 9 hero products
- `vendorSku` = styleNumber (industry standard — distributors use manufacturer style numbers)

## DB schema
- `Vendor`: id, name, website, isActive, createdAt, updatedAt
- `ProductVendor`: id, productId, vendorId, vendorSku, vendorProductUrl, isPreferred, isActive, notes, createdAt, updatedAt — UNIQUE(productId, vendorId)
- When setting `isPreferred=true` via PATCH, first clear all other preferred flags for that productId (enforced in API handler)

## API routes
- GET /api/vendors — list active vendors
- GET /api/products/[id]/vendor-sources — list sources with vendorName + vendorWebsite
- POST /api/products/[id]/vendor-sources — add source
- PATCH /api/products/[id]/vendor-sources/[vsId] — update (isPreferred clears siblings)
- DELETE /api/products/[id]/vendor-sources/[vsId] — remove

## UI
- catalog-admin "Sources" column: preferred vendor name + count badge
- product/[id].tsx "Sources" tab (4th tab, Building2 icon): list with ★ preferred, edit/delete/mark-preferred actions
- "Vendor" chip/label everywhere renamed → "Manufacturer"
- ProductFormModal (catalog-admin) + EditProductModal (product detail): field still writes to `product.vendor` DB column
