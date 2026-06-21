---
name: Prisma String = PostgreSQL text
description: Prisma String @id maps to PostgreSQL text, not uuid — ::uuid casts on parameters break WHERE comparisons.
---

## The Rule

`String @id @default(uuid())` in Prisma → the PostgreSQL column type is **`text`**, not `uuid`.

**Broken pattern (generates `operator does not exist: text = uuid`):**
```sql
WHERE id = $1::uuid          -- text col vs uuid param → no operator
WHERE "productId" = $1::uuid -- same
WHERE id = $1::uuid AND "productId" = $2::uuid
```

**Correct patterns:**
```sql
WHERE id = $1               -- text = text ✓
WHERE id = ANY($1::text[])  -- text = ANY(text[]) ✓
```

**For INSERT/UPDATE values into text id columns:** just use `$1` — no cast needed. PostgreSQL stores whatever the parameter value is.

**For enum columns in INSERT values:** keep the explicit cast: `$2::"ProductAssetType"`. PostgreSQL cannot auto-coerce text to custom enum without a cast. This is safe because it's a value cast, not a comparison.

**Why:**
Confirmed in production by the `[GET /api/products/:id] error: operator does not exist: text = uuid` failure. All Product, ProductColor, ProductAsset, ProductPlacement id fields are Prisma `String` → `text` in Postgres. The `::uuid` cast on the parameter side promotes it to `uuid` type, then `=(text, uuid)` fails because no operator exists for that pair.

**How to apply:**
Any time you write a parameterized SQL query against a Prisma-managed table that uses `String @id`: strip `::uuid` from all WHERE comparisons and ANY() array comparisons. Applies to every `app/api/products/**` route and any other Prisma-managed table with String PKs/FKs.
