---
name: Metric typography standardization
description: Single source of truth for CRM/ERP metric value + label typography
---

# Metric typography

All metric numbers and labels across the app derive from one module: `components/Metric.tsx`,
which exports `metricValueStyle`, `metricLabelStyle`, and `MetricValue`/`MetricLabel`/`MetricCard`.

Existing per-screen style objects (`revenueStatValue`/`revenueStatLabel`/`v2SecondaryStatValue`
in `app/crm/[id].tsx`, and `statValue`/`statLabel` in `app/(tabs)/client-hubs.tsx`) are kept as
aliases that spread the shared constants, so the JSX stays untouched but typography stays uniform.

**Why:** the spec literally asked for 28px metric values, but metric rows render 3–4 columns
(flex:1 boxes). At 28px, currency like `$1,162.12` overflows on mobile and breaks the row layout.
The standard was therefore set to match the approved "Active Projects" reference: value 18px/800,
label 12px/500.

**How to apply:** any new metric row must reuse `components/Metric.tsx` (or the alias styles),
never hardcode a new font size/weight. Keep alias styles as `{ ...metricValueStyle }` /
`{ ...metricLabelStyle }` to prevent drift. Color overrides go via the style array
(`[base, { color }]`) or the `color` prop — never by redefining size/weight.
