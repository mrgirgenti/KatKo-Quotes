---
name: Admin sidebar scope
description: Where the persistent platform sidebar/drawer is rendered and which routes intentionally lack it.
---

# Admin sidebar / drawer scope

The persistent grouped sidebar (desktop/tablet) and slide-in drawer (mobile) live in `app/(tabs)/_layout.tsx` and therefore only wrap routes inside the `app/(tabs)` group. Shared nav is centralized in `components/navConfig.ts` (data + `isItemActive`) and rendered by `components/SidebarContent.tsx` (`SidebarNav` + `ProfileFooter`), reused by both `components/Sidebar.tsx` and `components/MobileDrawer.tsx`.

**Why:** The admin chrome must NOT appear on the client-facing `portal/[orgId]` experience, and full-screen drill-down pages (quote editor, `crm/[id]`) keep their own back-button header.

**How to apply:** Any new *top-level* admin destination that should show the sidebar must be created under `app/(tabs)/`. That is why Reports was moved from `app/reports.tsx` to `app/(tabs)/reports.tsx` (and its `<Stack.Screen>` stripped + an in-page title added). Detail/portal pages stay outside `(tabs)` on the root Stack in `app/_layout.tsx`.
