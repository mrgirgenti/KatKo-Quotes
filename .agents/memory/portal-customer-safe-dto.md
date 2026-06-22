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
- Rebuild `calculations` to only: subtotal, salesTax, shipping, total,
  totalPerPiece, totalQuantity, and a single combined `processingFee`.
- **Fee presentation rule:** combine `onlineFee` + `cardFee` into ONE
  `processingFee` ("Processing & Handling"). Never expose the separate fee
  fields or any fee *rate/percentage* — only the combined customer-paid dollar
  amount.
- When leak-checking with regex, base64 mockup `data:` URIs produce false-positive
  substring hits for `cost`/`cog`; verify against actual JSON keys, not substrings.
