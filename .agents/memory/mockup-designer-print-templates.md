---
name: Mockup Designer print templates
description: How smart print-location templates + live inch geometry work in the Mockup Designer.
---

# Mockup Designer print templates (smart placement)

Print-location templates are a CLIENT-SIDE adapter over the static garment zones
in `garmentData.ts`, NOT a new persisted store. `resolveTemplate(zone, dbOverride?)`
derives defaults (default/max W&H, 0.25" safe area, snap anchor, decoration method)
from zone geometry, then optionally overrides ONLY the inch sizing from the catalog DB.

**Why:** Product Model Law (never gate mockups on the catalog) + No Parallel Systems.
DB sizing comes from `/api/products/[id]/effective-placements` and is pulled only
when `configuredProduct.productId` exists (a linked catalog product); manual /
free-text products always fall back to derived templates.

**Geometry invariant:** `computeArtRect(zone, input)` is the SINGLE source of artwork
geometry, shared by BOTH the on-screen overlay and the export canvas (`composeCanvas`)
so they stay pixel-identical. UNITS_PER_INCH=25. The overlay applies a +30 y DISPLAY
offset on the ZONE PARENT only — children use zone-relative coords (no +30); the
export canvas uses raw canvas coords (no +30). If you add a new render path,
replicate this asymmetry or overlay/export will diverge.

**How to apply:** Template status (Using Template / Custom Size / Custom Position /
Custom Method) is DERIVED at render by comparing the placement to its resolved
template via `approxEqual` — there are NO stored status booleans. "Apply Template"
and "Reset to Template" both fully restore size+position+snap+decoration. Per-garment
presets plug in later via the optional `template?` field on a ZoneDefinition and/or
the DB override map keyed by PrintLocation.
