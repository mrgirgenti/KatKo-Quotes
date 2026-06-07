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

**Fix that works:** tag the subtree root with a dataset attribute (e.g. `data-kk-sidebar`
via `KK_SIDEBAR_DATASET`) and inject ONE web CSS block resetting `outline:none` +
`box-shadow:none` on `[data-kk-sidebar] *:focus, [data-kk-sidebar] *:focus-visible`.
**How to apply:** when a focus ring persists despite per-style fixes, stop whack-a-mole —
scope a single descendant CSS reset to the container subtree instead.
