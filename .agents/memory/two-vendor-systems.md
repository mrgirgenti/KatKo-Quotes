---
name: Two separate "vendor" systems
description: The app has two unrelated tables both surfaced as "vendors"; don't confuse them.
---

# Two separate "vendor" systems — don't confuse them

1. **`Vendor` table** — the SOURCING list used for product source assignment (`ProductVendor` FK → `Vendor.id`). Full CRUD: `/api/vendors` GET (auth; `?active=false` returns inactive too; rows carry a joined `sourceCount`) + POST; `/api/vendors/[id]` PATCH + DELETE (DELETE 409s if sources exist). Fields: `name` (unique), `website`, `catalogUrl`, `isActive`. Managed via the "Sourcing Vendors" screen (`app/sourcing-vendors.tsx` → `components/catalog/SourcingVendorManager.tsx`), reached from the Catalogs tab header. Source-assignment pickers filter to active vendors in the UI AND the assignment APIs reject inactive vendors server-side (`app/api/products/[id]/vendor-sources` POST, `app/api/products/bulk` assign-source/set-preferred-source). Existing inactive sources still DISPLAY (edit modal falls back to `VendorSource.vendorName`).

2. **`ClientCatalog` table** — the **Catalogs tab** UI cards (`app/(tabs)/catalogs.tsx`), API `/api/client-catalogs` with full CRUD. Fields include `catalogUrl`, `websiteUrl`, `isActive`, `category` (Apparel/Promotional/Signage), `showInClientHub`, `isFeatured`. Also feeds the client hub.

**Why it matters:** "Vendor management" requests usually mean system 1 (sourcing), but the user sees system 2 (the Catalogs tab) as "their vendors". Both have messy/duplicate data.

**Approved apparel vendor whitelist (owner-stated, 7):** S&S Activewear, SanMar, McCreary's, Shaka Wear, Independent Trading, LA Apparel, Momentec. Owner rule: vendor list is fully user-managed — **never auto-seed/auto-create** vendors beyond explicit approval. Apparel BRANDS (Gildan, Bella+Canvas, Next Level, Port Authority, Sport-Tek, Richardson, YP Classics) are `Product.brand`/`Product.vendor` LABELS, never vendor records.
