---
name: Expo SSR web deployment (Replit autoscale)
description: How to deploy this Expo Router app (web.output "server") so API routes work and the health check passes.
---

# Expo Router SSR web deployment on Replit

This app uses `web.output: "server"` (SSR + ~27 API routes). Deploy target = **autoscale**.

- **build (current):** `echo "dist is pre-built and committed"` — instant no-op. `dist/` is committed to the repo (maps excluded). Rebuild locally with `bunx expo export --platform web` (~2.5 min) and commit the updated `dist/` before re-deploying. Source maps go in .gitignore (`dist/**/*.map`) to keep the commit ~34MB instead of 62MB.
- **Why pre-built:** Replit autoscale build timeout is ~2 minutes; `expo export` for this 3336-module app takes ~2.5 minutes → build gets killed. Pre-building and committing dist/ sidesteps the timeout entirely.
- **run (production):** MUST be the production server `bunx expo serve --port 5000`, NOT the dev command.

**Why:** The dev run command `expo start --web` launches the Metro **development bundler**, which is slow to boot and is not a production server. On autoscale the deployer waits for an HTTP 200 on `/` (startup probe); `expo start` never becomes healthy fast enough → promote/health-check phase times out → build marked `failed`, even though the build/export phase succeeded (logs show `Exported: dist`). `expo serve` just serves the prebuilt `dist/` (incl. API routes) and boots fast, so the probe passes.

**How to apply:** If publishing fails with the build succeeding but the deploy never going live (promote/health-check failure), check `.replit` `[deployment].run` first — it must be `expo serve`, not `expo start`.

**Also:** Never use the `static` deployment target for this app — static cannot run server code, so API routes break in production even if the URL loads. (A stale March static build was serving as "live" while autoscale republishes failed.)

**Secrets:** Production already mirrors dev secrets (`DATABASE_URL`, `PG*`, `SESSION_SECRET`); resend is a runtime-managed integration. Re-verify with `viewEnvVars` if startup crashes recur.
