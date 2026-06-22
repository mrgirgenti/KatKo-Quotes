---
name: Customer-facing portal DTOs must be whitelist-sanitized
description: Unauthenticated client-hub endpoints must never return raw Project JSON — it carries internal financials and sourcing.
---

# Customer-facing portal endpoints must whitelist-sanitize Project JSON

Any **unauthenticated / customer-facing** portal endpoint (client hub, public
quote/project detail) that surfaces a Project must build an explicit
**whitelist DTO**. Never `Response.json(row)` a Project row, and never pass
`Project.lineItemsData` or `Project.calculations` through untouched.

**Why:** those two JSON blobs carry internal financials and supply-chain data —
product/service cost (each & total), markup amount & %, COGS, per-line fees, plus
`apparelProvider` / `applicator` sourcing. They are invisible in the schema
(they're free-form JSON columns), so it is easy to leak the whole thing to an
unauthenticated client without realizing it. A regression here exposes margins.

**How to apply:**
- Rebuild `lineItemsData` by mapping only customer-safe keys (designName,
  serviceStyle, locations, product, productColor, mockupUri, sizes, and a
  recursively-whitelisted `garmentVariants`).
- Rebuild `calculations` to only: subtotal, onlineFee, cardFee, rushFee,
  salesTax, shipping, total, totalPerPiece, totalQuantity.
- **Fee presentation rule (Katalyst terminology):** surface `onlineFee` and
  `cardFee` as SEPARATE rows — "Online Fee" and "Card Fee" — plus a future
  "Rush Fee" (`rushFee`). NEVER combine them into a single "Processing &
  Handling" amount (that was the old behavior and is now wrong). Render a fee
  row only when its value > 0. Never expose any fee *rate/percentage*, only the
  customer-paid dollar amounts. Both customer surfaces (quote detail API and
  project detail API) must emit the same fee shape.
- When leak-checking with regex, base64 mockup `data:` URIs produce false-positive
  substring hits for `cost`/`cog`; verify against actual JSON keys, not substrings.
