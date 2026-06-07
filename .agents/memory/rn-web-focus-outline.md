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
