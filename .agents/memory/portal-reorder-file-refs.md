---
name: Portal reorder carries file REFS, never file moves
description: Why the Client Hub reorder copies per-line mockup URL refs but must not reuse the artworkFromBin attach path.
---

The portal's "attach existing media-bin file to a request" path (`artworkFromBin`)
finalizes on submit by **re-parenting** the file: `PATCH /api/files/{id}` with a new
`projectId`. That MOVES the file off whatever project it was on.

**Rule:** The Reorder flow must carry artwork forward as non-destructive references
only — per line item it sets `mockupBinFile` → on submit becomes a `mockupUri` URL
string (`/api/files/{id}?inline=true`) stored in the new project's lineItemsData.
Never populate `artworkFromBin` (or otherwise PATCH projectId) from a SOURCE
project's files during reorder.

**Why:** Reusing the artworkFromBin attach path with the source project's ARTWORK
files would strip that artwork off the original project (data corruption of a
completed order). "artwork refs" in the reorder requirement = these mockup URL refs.

**How to apply:** If a future task wants reorder to also bring the source project's
project-level ARTWORK media-bin files, it needs a real backend COPY endpoint
(new File rows / duplicated storage objects), not the existing move-via-PATCH path.
