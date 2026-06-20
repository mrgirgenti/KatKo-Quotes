---
name: SSR first-paint visual flashes
description: Why global visual transforms must be declared in the SSR <head>, not applied in a post-hydration effect, on this Expo Router SSR web app.
---

# Declare global visual styling at first paint, not after hydration

Any app-wide visual transform — page `zoom`, base font scale, a global background,
scrollbar suppression, etc. — must be present in the SSR `<head>` (`app/+html.tsx`)
so it applies on the very first painted frame.

**Why:** This app server-renders HTML, then React hydrates. If you set a global
style in a `useEffect` (e.g. `document.documentElement.style.zoom = '0.9'` in
`app/_layout.tsx`), the page paints once at the un-styled value (100%) and then
visibly snaps to the styled value (90%) the moment the effect runs. Users perceive
this as a "resize / flicker / large→small" flash on every load — most obvious on a
single centered element like the portal login card.

**How to apply:** Put the rule in the `<head>` CSS in `app/+html.tsx` (this is also
where the focus-reset and `::-webkit-scrollbar` suppression already live for the
same first-paint reason). Do NOT re-introduce the equivalent post-hydration
assignment. `document.documentElement` IS the `<html>` element, so `html{zoom:0.9}`
in the head is exactly equivalent — just earlier and flash-free.
