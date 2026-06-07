---
name: RN-Web focus outline (blue box)
description: Why a blue box appears around pressables on web and how to remove it
---

# React-Native-Web focus outline

react-native-web renders `TouchableOpacity`/`Pressable` (and some containers) as
focusable `<div>`s. On web the browser draws its default focus ring — a blue
rectangle — when they receive focus (click, tab, or hover-then-focus). Users
perceive this as a stray "blue box".

**Fix:** add `outlineStyle: 'none' as any` to the offending element's StyleSheet
entry (web-only style; ignored on native, no crash). Applied to the Sidebar
container, hamburger, and navItem styles in `components/Sidebar.tsx`.

**Why / tradeoff:** removing the outline drops the visible keyboard-focus
indicator. Acceptable here because the user explicitly disliked it; if keyboard
a11y matters later, replace with a custom `:focus-visible` style instead of a
blanket removal.

## Per-style `outlineStyle:'none'` is NOT enough for a whole subtree
A persistent blue line in the sidebar survived even after adding `outlineStyle:'none'`
to individual styles, because *focusable descendants you don't control* (the RN-web nav
`ScrollView`, and other rendered `<div>`s) still drew the browser default ring. Per-element
style fixes only cover the elements you remember to tag.

A subtree-scoped reset (`[data-kk-sidebar] *:focus`) STILL wasn't enough — the blue ring
kept recurring because focusable elements outside the tagged subtree also draw it.

**Definitive fix (use this):** inject ONE GLOBAL web CSS block at the root layout
(`app/_layout.tsx`) resetting BOTH `outline:none` AND `box-shadow:none` on
`*:focus,*:focus-visible` (style id `kk-global-focus-reset`), injected at MODULE scope
(runs before first paint) and re-asserted in the `useEffect`. The app's inputs use border
styling for focus, so removing the default ring is safe.

**Box-shadow gap (important):** an earlier version stripped `box-shadow` only from
`a/button/[tabindex]:focus`, NOT from plain `<div>`s. RN-web renders ScrollViews/containers
as focusable plain `<div>`s, and some browsers paint the focus ring via box-shadow on those
— so the blue ring survived. On a container that OVERFLOWS the viewport (e.g. the
horizontal-scroll tables, inner content wider/taller than the screen) only the ring's LEFT
edge is visible → it reads as a stray FULL-HEIGHT VERTICAL BLUE LINE, not a box. Fix = apply
`box-shadow:none !important` to EVERY `*:focus`, not just a/button/[tabindex].
**Ruling out non-focus causes first:** grep the whole repo for blue (hex/rgba/borders/
shadows/bg), thin tall Views (`width:1-4`+blue), `position:fixed` overlays, and resize/
dnd/split-pane libs. If none exist AND a fresh-load screenshot is clean, it's the focus ring
(or, if it still shows after the global reset + hard refresh, an external browser extension/
overlay — there is no blue anywhere in this app's styles).

**Critical debugging note:** the blue ring only appears AFTER a real click/keyboard focus.
A fresh page load (and therefore the screenshot tool, which loads fresh) shows NO ring —
you CANNOT reproduce it via screenshot. Don't conclude "it's fixed" from a clean
fresh-load screenshot; reason about the CSS instead. The user's screenshot showing an
active/clicked nav item is the real signal.
