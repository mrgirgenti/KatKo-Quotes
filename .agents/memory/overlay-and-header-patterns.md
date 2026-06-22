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

## In-row actions column must sit OUTSIDE the flexible data block
In a no-horizontal-scroll flex table, a row's ⋯/actions cell must be a FIXED-width sibling
rendered AFTER (outside) a `flex:1, overflow:'hidden'` wrapper that holds the data columns —
not just the last flex column. The data columns then shrink/truncate to fit any width while
the actions column always keeps its space.
**Why:** if the actions cell is the last flex child and the summed `minWidth`s of the data
columns exceed a narrow card, the row overflows right and the (overflow:hidden) card clips the
actions off-screen — re-creating the "can't reach the menu" bug. Putting actions outside the
shrinkable block guarantees it is always visible. (See `ContactsPeopleTable.tsx`.)

## Detail-page back header — shared component, must match native header exactly
`components/PageBackHeader.tsx` is the single back-nav header for all detail pages. Visual
source of truth = the global native Stack header in `app/_layout.tsx` (black #000 bar, white
ChevronLeft(20)+"Back" 15/500, white title 17/600). To migrate a page: set
`headerShown:false` for that route in `_layout.tsx` AND render `<PageBackHeader title=.../>`
at the top of the page's main return.
**Why:** standardization, not redesign — users must not notice a change on already-correct pages.

## Two parallel mobile nav drawers — keep them in sync
The main app uses `components/MobileDrawer.tsx` (`MobileShell`: hamburger top bar → slide-in
drawer with logo header, nav, profile footer). The **Client Hub portal** (`app/portal/[orgId].tsx`,
dashboard step) has its OWN inline copy of that pattern (top bar = hamburger + "Client Hub" text,
its own `mobileDrawer*` styles + open/close Animated state) — it does NOT import MobileShell.
**How to apply:** a change to one mobile nav (drawer behavior, footer actions, scrim) usually
needs mirroring in the other. Both use the plain-`View`+responder scrim (never `Pressable`).

## Gotcha: crm/[id] (and similar huge pages) hydrate slowly on web
`app/crm/[id].tsx` is ~6000+ lines. On Expo web it can sit on its own "Loading…" branch
(`directOrgLoading && !org`, Clock icon) for a long time while the client bundle hydrates +
the `/api/orgs/[id]` fetch resolves. The `screenshot` tool reloads the route cold every call,
so it often captures this loading state even though the page is fine. The org API itself is
fast (verify with `curl https://$REPLIT_DEV_DOMAIN/api/orgs/<id>`). Validate heavy pages via
a lighter route (e.g. quote/[id]) or curl, not repeated screenshots.
