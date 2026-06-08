---
name: Safari WebKit scrollbar suppression
description: Why and how to hide scrollbar tracks in Safari for this RN-web app.
---

## The rule
Add `*::-webkit-scrollbar { display: none !important; }` (plus -track, -thumb, -corner variants) in BOTH:
- `app/+html.tsx` — SSR head, covers first paint before JS runs
- `app/_layout.tsx` `KK_FOCUS_RESET_CSS` — runtime re-injection, re-appended last so it always wins

## Why
`scrollbar-width: none` (used by RN Web's `showsVerticalScrollIndicator={false}` → class `r-scrollbarWidth-2eszeu`) is **Firefox/Chrome only**. Safari ignores it entirely. Without the WebKit pseudo-element override, Safari renders the native scrollbar track on any `overflow: scroll` container using the system accent colour (blue on most macOS/iOS setups). This appeared as a persistent thin blue vertical line at the right edge of the sidebar nav ScrollView (inside the 64px collapsed sidebar, further offset by the `zoom: 0.9` applied to `<html>`).

## How to apply
Any time a new scrollable element is added and must not show its scrollbar, the global `*::-webkit-scrollbar { display: none }` rule already covers it — no per-element work needed. The two injection sites cover SSR + client hydration.
