---
name: RN Web focus outline suppression
description: How to reliably suppress all blue focus rings in this Expo web app — CSS alone is not enough.
---

# React-Native-Web focus outline (blue line artifact)

RN Web renders `<ScrollView>`, `<Pressable>`, and other interactive components as `<div tabIndex="0">`. On focus the browser paints a blue `outline`. When the element overflows the viewport, only one edge is visible — a "vertical blue line" artifact. A full-screen element (like a scrim Pressable) shows both left AND right edges.

## Why CSS-only approaches fail

`outlineStyle: 'none'` as a React Native inline style prop translates to `outline-style: none` on the DOM element's `style` attribute. **RN Web (react-native-web) internally applies focus styles via JavaScript (`element.style.outline = ...`) after the component renders, overwriting our prop.** A stylesheet rule with `!important` does NOT override a JS-set inline style (inline styles always win over stylesheet rules regardless of `!important`).

**Why `*:focus { outline: none !important }` in a `<style>` tag also fails in some cases:** A stylesheet `!important` rule overrides a UA-stylesheet rule, but NOT an inline style set directly via `element.style`. JS-applied inline styles beat stylesheet rules.

## The correct three-layer fix

### Layer 1 — CSS rule (handles UA-stylesheet rings)
```js
'*:focus,*:focus-visible{outline:none !important;box-shadow:none !important;}'
```
Injected via `document.createElement('style')` at module scope in `app/_layout.tsx`.

### Layer 2 — JS event listener (handles RN Web inline-style rings)
```js
document.addEventListener('focus', (e) => {
  const el = e.target;
  if (el && el.style) {
    el.style.setProperty('outline', 'none', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
  }
}, true /* capture phase */);
```
`setProperty(prop, value, 'important')` sets an **inline** `!important` rule — the highest possible CSS priority. Fires in capture phase so it runs before any RN Web post-focus handlers. Guard with `window.__kkFocusListenerBound` to prevent duplicate listeners on hot-reload.

### Layer 3 — Replace focusable dismiss targets with non-focusable Views
A scrim `<Pressable>` (full-screen absoluteFill) used as "tap outside to close" gets `tabIndex="0"` and is the #1 source of the full-screen border artifact. Replace with a plain `<View>` using the responder system:
```jsx
<View
  style={StyleSheet.absoluteFill}
  onStartShouldSetResponder={() => true}
  onResponderRelease={onClose}
/>
```
`View` never gets `tabIndex="0"` so it can never receive browser focus.

## Common pitfalls
- **Missing import:** If `KK_SIDEBAR_DATASET` (or any dataset spread) is used without being imported, the spread is a no-op (spreading undefined = `{}`), so `data-kk-sidebar` is never applied and scoped CSS never fires. Always verify imports match usage.
- **Fresh load looks clean:** The blue ring only appears after a real click/keyboard focus. Fresh-load screenshots show no ring — don't conclude "fixed" from a clean screenshot.
- **Box-shadow gap:** Some browsers paint the focus ring via `box-shadow` on plain `<div>`s, not `outline`. Always reset BOTH.

**Why:** Per-element `outlineStyle:'none'` in JSX style prop applies only to the element's initial inline style; RN Web may overwrite it post-render via JS. The JS event listener with `setProperty(..., 'important')` cannot be overridden by anything.

**How to apply:** Whenever adding a full-screen or viewport-spanning interactive overlay (drawer scrim, modal backdrop), use `View` + responder instead of `Pressable`. Always include the JS event listener layer in `injectFocusReset()`.
