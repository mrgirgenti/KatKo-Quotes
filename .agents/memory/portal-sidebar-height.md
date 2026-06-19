---
name: Portal sidebar full-height fix
description: How to make the Client Hub sidebar fill the full viewport height reliably in Expo SSR web.
---

# Portal sidebar full-height

## The rule
Fix the global CSS root chain in `+html.tsx` first. Then `flex: 1` on the layout is enough — no `vh` units, no sticky, no explicit height on the sidebar.

**Why:** Every `vh` / `height: '100vh'` attempt on the sidebar failed because React Native Web's style pipeline doesn't reliably pass string viewport units, AND `flex: 1` alone only fills the parent when every ancestor has a defined height. `+html.tsx` was missing `height: 100%` on `html, body, #root, #__next`, so no flex chain ever reached the viewport.

**How to apply:**

Step 1 — `app/+html.tsx` FOCUS_RESET_CSS must include:
```js
'html,body,#root,#__next{height:100%;margin:0;padding:0;}' +
```
Add this BEFORE the outline-reset line. This is the foundation; without it no approach works.

Step 2 — `dash.layout` (simple, no Platform.select needed):
```js
layout: { flex: 1, flexDirection: 'row', backgroundColor: '#F3F4F6' }
```

Step 3 — `dash.sidebar` (no explicit height, stretches naturally):
```js
sidebar: {
  backgroundColor: SIDEBAR_BG,
  flexDirection: 'column',
  overflow: 'hidden' as any,
}
```

With `html/body/#root` at `height: 100%`, the flex chain propagates viewport height all the way down. The sidebar fills it via default `alignItems: stretch`. No `position: sticky`, no `100vh` string, no JS measurement needed.
