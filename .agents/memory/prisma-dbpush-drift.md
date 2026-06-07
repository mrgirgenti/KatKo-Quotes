---
name: Prisma db push drift
description: Why additive schema columns are applied via raw SQL ALTER, not prisma db push
---

The live Postgres has columns that drift from `prisma/schema.prisma` (e.g. `Quote.projectNumber` exists in DB but not schema). `prisma db push` therefore tries to DROP those columns and refuses without `--accept-data-loss`.

**Rule:** for additive, low-risk column changes, apply them with a raw `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` against `$DATABASE_URL` rather than `prisma db push`. Keep the schema file updated in lockstep so it stays the source of truth.

**Why:** running `db push --accept-data-loss` would silently drop unrelated drifted columns that still hold data. Resolving full drift is a separate, deliberate task.

**How to apply:** when adding a column, edit schema.prisma AND run `psql "$DATABASE_URL" -c 'ALTER TABLE "X" ADD COLUMN IF NOT EXISTS ...'`.

**Tooling:** `npx` is not on PATH; run Prisma via `bun run node_modules/.bin/prisma ...`.
