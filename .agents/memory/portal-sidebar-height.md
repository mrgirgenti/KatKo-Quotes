---
name: Portal sidebar full-height fix
description: How to make the Client Hub sidebar fill the full viewport height reliably in Expo SSR web.
---

# Portal sidebar full-height

## The rule
Give `dash.layout` `height: '100vh'` (not `flex:1` + `minHeight`). The sidebar then stretches to fill it naturally — no `position:sticky`, no explicit height on the sidebar needed.

**Why:** `flex:1` only fills its parent when the parent has a defined height. The portal root is a conditional-steps View with no fixed height, so `flex:1` never reliably propagates. `minHeight: '100vh'` on the sidebar also failed because it requires the parent chain to have a defined height for flex-stretch to work. Setting an explicit `height: '100vh'` on the layout container itself is the reliable fix.

**How to apply:**
```js
// dash.layout
layout: {
  flexDirection: 'row',
  backgroundColor: '#F3F4F6',
  ...Platform.select({
    web: { height: '100vh' as any, overflow: 'hidden' as any } as any,
    default: { flex: 1 },
  }),
}
// dash.sidebar — NO position:sticky, NO height/minHeight
sidebar: {
  backgroundColor: SIDEBAR_BG,
  flexDirection: 'column',
  overflow: 'hidden' as any,
}
```

The `overflow: 'hidden'` on the layout is safe because each view renders its own `ScrollView` for internal scrolling — the layout never needs to scroll.
