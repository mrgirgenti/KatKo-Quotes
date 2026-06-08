---
name: Prisma db push drift
description: prisma db push wants to drop unrelated drifted columns on this repo; use direct ALTER for additive changes
---

# Prisma `db push` drifts against the live DB

`prisma/schema.prisma` is NOT fully in sync with the actual Postgres DB. Running
`bun run node_modules/.bin/prisma db push` surfaces destructive warnings for
columns that exist in the DB but were removed from the schema (e.g. it wanted to
DROP `Quote.projectNumber`, which still held real data). Passing
`--accept-data-loss` would delete that unrelated data.

**Rule:** For a purely *additive* schema change (adding one column), do NOT run
`prisma db push`. Apply it directly instead:

```sql
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "<col>" <type> NOT NULL DEFAULT <default>;
```

Keep the `.prisma` model updated too (for documentation / future full migration),
but the DB change comes from the ALTER, not from push.

**Why:** Avoids data loss from pre-existing schema drift unrelated to your task.
**How to apply:** Any time you add a column and `db push` reports it wants to drop
something you didn't touch — stop, run the targeted ALTER via executeSql instead.
