---
name: SSR responsive shell selection
description: How to choose desktop vs mobile layout without an SSR hydration mismatch / flash in this Expo Router web app.
---

# SSR-safe responsive shell

`hooks/useBreakpoint.ts` is driven by `useWindowDimensions()`, which resolves width to **0 on the server** (no `window`). A width of 0 reads as "mobile", so any layout that branches directly on `isMobile` will render the mobile shell during SSR and then switch to the desktop sidebar after the client knows the real width.

**Why:** On desktop this produced a visible "mobile top bar" flash on first paint and risks a React hydration mismatch (server markup ≠ first client render).

**How to apply:** In `app/(tabs)/_layout.tsx`, keep a `mounted` flag (`useState(false)` + `useEffect(() => setMounted(true), [])`) and compute the shell as:
`const useMobileShell = mounted ? isMobile : Platform.OS !== 'web';`
This makes SSR and the first client render identical (desktop shell on web), so no mismatch; the real breakpoint only applies after mount. Give the desktop `<Sidebar>` a `key` that changes once `mounted` flips so it remounts and re-reads `defaultCollapsed` (needed for tablet's collapsed-by-default, since Sidebar captures the default only at init).
