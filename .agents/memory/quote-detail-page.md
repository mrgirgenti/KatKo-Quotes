---
name: Quote Details page (app/quote/[id].tsx) notes
description: Layout structure and gotchas for the large quote detail screen
---

## Identity area = two cards, sidebar is locked
The top of the left content column is a two-card row (`renderOrderInfo`): a **Quote
Information** card (project name → org name → "{quoteNum} • {status}" → ORDER/DUE DATE)
and a **Primary Contact** card. They sit above Line Items inside `desktopLeft`. The
right sidebar (Pricing Summary, Sales Tracking) is an approved/locked design — do not
restyle or move it. Desktop row only when `isDesktop && showContactCard`; cards stack
on mobile. Contact card is fixed 280px on desktop, full-width on mobile.
DUE DATE maps to `quote.inHandsDate` (there is no separate dueDate field).

## Status labels/colors come from STATUS_CONFIG (types/quote.ts)
`STATUS_CONFIG[status]` gives `{label, color, bg, borderColor}`. Several active statuses
set `color:'#FFFFFF'` (white text meant for a solid badge bg). To show status as plain
text on a white card, fall back to `bg` when `color` is white — otherwise it's invisible.

## Gotcha: TWO StyleSheet.create objects in this file
`styles` (main) and `koArtStyles`. The breadcrumb styles (`breadcrumbBar`, etc.) are
mistakenly defined inside `koArtStyles`, but the JSX references `styles.breadcrumb*`, so
those are `undefined` and the breadcrumb renders unstyled. Pre-existing; if you ever
touch the breadcrumb, move those styles into the `styles` object.
