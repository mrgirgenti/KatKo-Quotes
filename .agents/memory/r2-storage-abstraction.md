---
name: R2 storage abstraction
description: How the file storage provider system works — local vs R2 selection, storageKey formats, bucket routing, and deployment notes.
---

## The rule
All file I/O goes through `lib/storage/` — never call `fs` directly from API routes.

**Why:** R2 is async/network; local fs is sync but must share the same async interface for hot-swap.

**How to apply:** Import `writeUpload`/`readUpload`/`deleteUpload` from `lib/files` (they delegate to the singleton in `lib/storage/index.ts`). Never import from `lib/storage/` directly in API routes.

---

## Provider selection (lib/storage/index.ts)

| `STORAGE_PROVIDER` env | Provider used |
|------------------------|---------------|
| `r2`                   | R2StorageProvider |
| `local`                | LocalStorageProvider |
| *(unset)*              | LocalStorageProvider (safe default) |

Set `STORAGE_PROVIDER=r2` only in the **production** deployment. Dev container cannot reach R2 (Cloudflare blocks TLS from Replit's shared IP range — ECONNREFUSED).

---

## storageKey formats

| Provider | Format stored in DB |
|----------|---------------------|
| Local    | `{orgId}/{uuid}-{safeName}` |
| R2 public bucket | `pub/orgs/{orgId}/{uuid}-{safeName}` |
| R2 private bucket | `prv/orgs/{orgId}/{uuid}-{safeName}` |

The `pub/` / `prv/` prefix encodes which R2 bucket to use — no extra DB column needed.

R2 actual object key (used in S3 API calls) = storageKey stripped of the `pub/` or `prv/` prefix, i.e. `orgs/{orgId}/{uuid}-{safeName}`.

---

## Bucket routing

`isPublic` flag on `writeUpload(orgId, name, buffer, isPublic)`:
- `true`  → `katalyst-os-public` bucket → storageKey prefix `pub/`
- `false` → `katalyst-os-private` bucket → storageKey prefix `prv/`

Call sites set `isPublic = visibility === 'CLIENT_VISIBLE'`.

---

## Existing files (pre-R2)

Local keys (`{orgId}/{uuid}-{safeName}`) remain in the DB untouched. `LocalStorageProvider` still reads them fine. `R2StorageProvider` will return `null` for these keys (no `pub/`/`prv/` prefix → `parseStorageKey` logs an error and returns null). Migration is a separate future task.

---

## Credentials (Replit Secrets)

- `R2_ENDPOINT` — full URL, account ID embedded
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_BUCKET` = `katalyst-os-public`
- `R2_PRIVATE_BUCKET` = `katalyst-os-private`

---

## Testing checklist (deployed env only)

1. Set `STORAGE_PROVIDER=r2` in deployment env vars
2. Upload a file via Media Bin → check DB storageKey starts with `prv/` or `pub/`
3. Read the file back (thumbnail/preview in Media Bin)
4. Delete the file → confirm removed from both DB and R2 bucket
5. Upload a logo (org logo) → confirm storageKey prefix matches visibility
6. Upload via portal → same checks
