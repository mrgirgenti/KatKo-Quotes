---
name: Expo SSR export origin hang
description: expo export --platform web hangs silently at "Static rendering is enabled." when app.json origin points to an unreachable host.
---

## The Rule

The `origin` field in the `expo-router` plugin config (`app.json`) MUST be the actual production URL of the deployed app. If it points to an unreachable or wrong host (e.g. `https://rork.com/`), Expo Router's SSR static generation will make HTTP requests to that host during route rendering and hang indefinitely.

**Why:** After "Static rendering is enabled." is printed, Expo Router renders 50+ static route HTMLs by executing the server bundle. Part of that process uses the `origin` to construct absolute fetch URLs. An unreachable origin → silent network hang → `expo export` never finishes.

**How to apply:**
- When an app reports `expo export --platform web` hanging at "Static rendering is enabled." with no error, check `app.json` plugins → expo-router → `origin` first.
- The correct value is the production deployment URL, e.g. `https://katalytst-os.replit.app`.
- The export takes ~2–3 minutes for a large app (3,336 modules, 76 API routes); this is normal — don't mistake slowness for a hang unless it exceeds ~5 minutes.

**Corrected config:**
```json
["expo-router", { "origin": "https://katalytst-os.replit.app" }]
```
