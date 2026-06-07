---
name: Overlay & back-header platform patterns
description: How to do floating menus and detail-page back headers consistently in this Expo RN-web app
---

## Floating menus / popovers / dropdowns — use a Modal/portal, never absolute siblings
Inline menus rendered as `position:absolute` siblings of their trigger get CLIPPED by any
ancestor `ScrollView` or `overflow:'hidden'` container — raising `zIndex` does NOT help in
RN/RN-web. The only reliable escape is rendering the menu inside a `Modal` (a portal).

**How to apply:** Use `components/OverlayMenu.tsx` (render-prop `trigger`/`children`, anchors
via `measureInWindow`, viewport-clamped) for action menus/popovers. `components/Dropdown.tsx`
is the original proven Modal-based reference. Do not reintroduce absolute-positioned menus.

## Detail-page back header — shared component, must match native header exactly
`components/PageBackHeader.tsx` is the single back-nav header for all detail pages. Visual
source of truth = the global native Stack header in `app/_layout.tsx` (black #000 bar, white
ChevronLeft(20)+"Back" 15/500, white title 17/600). To migrate a page: set
`headerShown:false` for that route in `_layout.tsx` AND render `<PageBackHeader title=.../>`
at the top of the page's main return.
**Why:** standardization, not redesign — users must not notice a change on already-correct pages.

## Gotcha: crm/[id] (and similar huge pages) hydrate slowly on web
`app/crm/[id].tsx` is ~6000+ lines. On Expo web it can sit on its own "Loading…" branch
(`directOrgLoading && !org`, Clock icon) for a long time while the client bundle hydrates +
the `/api/orgs/[id]` fetch resolves. The `screenshot` tool reloads the route cold every call,
so it often captures this loading state even though the page is fine. The org API itself is
fast (verify with `curl https://$REPLIT_DEV_DOMAIN/api/orgs/<id>`). Validate heavy pages via
a lighter route (e.g. quote/[id]) or curl, not repeated screenshots.
