---
name: Metro restart loop — Expo type generator + Replit tooling dirs
description: Why Metro's bundle resets to 0/1 mid-compile and how to prevent it.
---

## Rule
Add `.expo/types`, `.agents`, and `.local` to Metro's `blockList` in `metro.config.js`. Without this, Metro restarts the bundle every time those dirs are written to.

## Why
Three separate writers trigger Metro's file-watcher during a normal session:

1. **`.expo/types/router.d.ts`** — Expo Router's type generator runs ~5–8 s after startup and rewrites this file while Metro is mid-compile (typically ~89% through the SSR bundle). Metro sees the write, cancels the in-progress bundle, and restarts from scratch, adding ~20–30 s to cold-start.

2. **`.agents/`** — Replit's agent tooling writes memory files here continuously throughout a session. Every write triggers an invalidation.

3. **`.local/`** — Agent task/session/skill files live here and are also written during the session.

## How to apply
In `metro.config.js`, expand `blockedDirs`:

```js
const blockedDirs = [".cache", "attached_assets", ".expo/types", ".agents", ".local"];
```

The same `blockList` pattern already used for `.cache` handles these correctly.

## Symptoms if missing
- Bundle gets to ~60–89% then resets to `0/1`
- Server TCP-connects but never sends an HTTP response (cold-start request times out)
- Replit preview shows blank white page on first load
- Loop persists: each new browser retry shows another `0/1` instant cache hit, but the proxy already returned empty
