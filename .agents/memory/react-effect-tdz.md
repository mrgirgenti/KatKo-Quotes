---
name: useEffect dependency TDZ
description: Why a useEffect that lists useCallback functions in its deps must be declared after them, or the page crashes with "Cannot access X before initialization".
---

# useEffect dependency array → temporal dead zone (TDZ)

A `useEffect(cb, [a, b, c])` dependency array is evaluated **during render**, at the
exact line where `useEffect(...)` is called — top-to-bottom with the rest of the
component body. If any dep (`b`, `c`) is a `const`/`useCallback` declared *below*
that `useEffect`, you get a runtime crash:

> Uncaught Error: Cannot access 'loadSources' before initialization

It is NOT enough that the effect *callback* runs after commit — the deps array
itself touches the variables synchronously during render.

**Rule:** any `useEffect` (or `useMemo`) whose dependency array lists `useCallback`
functions must be declared AFTER all of those callbacks.

**Why:** seen in `app/product/[id].tsx` (ProductDetailScreen) — a data-loading
`useEffect` listing `[loadTemplates, loadSources, loadVendors]` sat above the
`loadSources`/`loadVendors` `useCallback` declarations, so clicking into any
product crashed before first paint. Fix was to move the effect below all three.

**How to apply:** when reordering or adding effects/callbacks in large components,
keep the data-loading effect at the bottom, after every callback it depends on.
LSP/tsc will NOT catch this — it's a runtime TDZ, not a type error.
