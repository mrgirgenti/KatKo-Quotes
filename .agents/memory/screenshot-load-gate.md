---
name: Screenshot load gate
description: Why app_preview screenshots often show only "Loading…" on this app, and how to validate UI instead.
---

The Expo web app (SSR, `web.output: "server"`) renders a global "Loading…" gate (driven by UserContext/data fetch) before any page UI. The `screenshot` (app_preview) tool frequently captures only this gate and never the real page — even after restarting the workflow and waiting 25–30s. The dev server itself is healthy in these cases (Metro bundles fine, API routes respond), so a persistent "Loading…" screenshot is NOT evidence of a broken page.

**Why:** SSR hydration + auth/data gating resolves after the screenshot tool's capture window; the proxied preview the tool hits doesn't carry whatever session/data state the gate waits on.

**How to apply:** Don't burn turns re-screenshotting to validate detail-page changes. Validate via: (1) `bun run node_modules/.bin/tsc --noEmit` filtered to your touched files (NOTE: full `tsc`/`npx tsc` reliably TIMES OUT in this env — prefer LSP diagnostics), (2) code inspection of integration points, (3) `architect` review. Treat screenshots as best-effort only. The known pre-existing console warning "Unexpected text node: . A text node cannot be a child of a <View>." is unrelated noise.

**Screenshots CANNOT verify responsive breakpoints.** When a screenshot does render a page, it captures the **pre-hydration** state: `useWindowDimensions()` is still 0, so every page reads `isMobile=true` (stacked filters, ProjectCard/SaleRow cards, the mobile "Sort:" chip strip) while `app/(tabs)/_layout.tsx` simultaneously FORCES the desktop sidebar (its `mounted`-guard, see `ssr-responsive-shell.md`). The result looks like a desktop regression (mobile content + desktop sidebar in a ~1280px image) but is NOT — it corrects after hydration in a real browser. Verify breakpoint work by reading the gating in the diff (desktop = `!isMobile && !isTablet` → full layout; tablet hides columns via `isTablet`), not by screenshot.
