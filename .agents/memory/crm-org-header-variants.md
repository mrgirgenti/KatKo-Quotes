---
name: CRM org-detail header variants
description: Which org-detail header actually renders in app/crm/[id].tsx and where the logo Change/Remove links come from.
---

# Org-detail header variants (app/crm/[id].tsx)

There are THREE org-header implementations in `app/crm/[id].tsx`, but only the V2 ones render.

- The whole page is gated by `FLAG_ORG_LAYOUT_V2` (in `constants/featureFlags.ts`). It is `true`, so the component returns the **V2 layout**.
- **Live headers (edit these):** `v2LPHeader` (desktop, 2-col CRM layout) and `v2MobileHeader` (mobile stacked).
- **Dead code (do NOT edit by mistake):** the legacy `leftPanel`/`orgIdentityCard` + `rightPanel` block after the `// END V2` return. It only renders when the flag is `false`.

**Why this matters:** grepping for `StatusBadge`, "header", or "Active Client" returns matches in the dead legacy `leftPanel` first, which misleads you into editing a header the user never sees. Confirm the flag and target the `v2*` headers.

**Logo Change/Remove links:** rendered by `components/OrgLogoUploader.tsx` (a text row under the avatar), NOT by the header itself. Pass `hideActions` to suppress them; the logo stays uploadable via click/camera badge. Status badge ("Active Client") = `<StatusBadge status={org.status} />`.
