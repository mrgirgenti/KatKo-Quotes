---
name: RN Web focus outline suppression
description: How to reliably suppress all blue focus rings and hover box-shadows in this Expo web app — CSS alone is not enough.
---

# React-Native-Web focus outline / hover box-shadow artifact

RN Web renders `<ScrollView>`, `<Pressable>`, and other interactive components as `<div tabIndex="0">`. On focus the browser paints a blue `outline`. When the element overflows the viewport, only one edge is visible — a "vertical blue line" artifact. A full-screen element (like a scrim Pressable) shows both left AND right edges.

## FIRST rule out the Replit-preview iframe before touching app code

A **thin vertical blue line at a FIXED viewport x-position (~40px), full-height, on EVERY page regardless of layout, that flashes when the mouse enters the preview from the LEFT (editor→preview side)** is NOT an app bug. It is **Chrome's focus ring on the Replit preview `<iframe>` itself** — you cannot style across the iframe boundary from inside, which is why no amount of `outline:none`/`box-shadow:none` CSS removes it.

A **blue rectangle matching the sidebar's dimensions (240×100vh), only visible when entering the preview from the left** is ALSO an iframe artifact — Chrome's native focus behavior forwarding focus to the sidebar `Animated.View` (the first DOM element) when the cursor crosses from the Replit agent panel into the preview pane. Confirmed: **not visible at `$REPLIT_DEV_DOMAIN` opened in a standalone browser tab, and never visible in production.** Do not investigate.

**Definitive triage (do this BEFORE writing any CSS/JS fix):**
- Open the app at `$REPLIT_DEV_DOMAIN` directly in a standalone browser tab (not the Replit preview pane). If the artifact **disappears** → confirmed iframe artifact. Stop all investigation.
- End users never see iframe artifacts — the published/standalone app has no embedding iframe.

**Conclusion:** Do not chase iframe-only artifacts with app code. **Why:** wasted multiple sessions on 4-layer CSS resets + gesture zone investigations that could never fix a browser iframe boundary behavior.

**Definitive proof (scanner result):** A `getComputedStyle` scan of every DOM element at the moment the blue line is visible returns `outline="rgb(0,0,0) none 2.77778px"`, `box-shadow="none"`, `border-left="0px none rgb(0,0,0)"` — all undrawn. The blue line has **zero presence in computed CSS**. It is painted by the parent page's browser engine at the iframe boundary, outside the iframe's own document, unreachable by any CSS or JS inside the app. This was verified on a blank page with zero app layout.

## Why CSS-only approaches fail

`outlineStyle: 'none'` as a React Native inline style prop translates to `outline-style: none` on the DOM element's `style` attribute. **RN Web (react-native-web) internally applies focus styles via JavaScript (`element.style.outline = ...`) after the component renders, overwriting our prop.** A stylesheet rule with `!important` does NOT override a JS-set inline style (inline styles always win over stylesheet rules regardless of `!important`).

**Why `*:focus { outline: none !important }` in a `<style>` tag also fails in some cases:** A stylesheet `!important` rule overrides a UA-stylesheet rule, but NOT an inline style set directly via `element.style`. JS-applied inline styles beat stylesheet rules.

## The CSS cascade ordering problem (hover box-shadow)

RN Web **lazily injects component CSS class rules** into `<head>` when a component first mounts — including hover box-shadow rules for `Animated.View`. In CSS, when two `!important` rules have **equal specificity**, the **later one wins**. If our global `*:hover{box-shadow:none!important}` style tag was appended before RN Web's component styles, RN Web's later-in-cascade hover rule overrides ours — even though we have `!important`.

**Confirmed instance:** `Animated.View` sidebar root container (`components/Sidebar.tsx` line 80) — RN Web applies a `box-shadow` class rule on `:hover`. The user sees this as a blue rectangle appearing when the mouse enters from the left side of the viewport (where the sidebar lives).

**Fix:** A `MutationObserver` on `document.head` watches for new child insertions; whenever our `#kk-global-focus-reset` style tag is no longer the last element in `<head>`, it re-appends it. This guarantees our rules are always last and always win. Implemented in `app/_layout.tsx` `injectFocusReset()` as Layer 3.

## The correct four-layer fix (as implemented in app/_layout.tsx)

### Layer 1 — CSS rule (handles UA-stylesheet rings + RN Web class-based rings)
```js
'*{outline:none !important;}' +
'*:not(input):not(textarea):not(select):hover{box-shadow:none !important;}'
```
Injected via `document.createElement('style')` at module scope in `app/_layout.tsx`. Must be the **last** `<style>` tag in `<head>` to beat RN Web's lazily-injected component class rules.

### Layer 2 — JS focus event listener (handles RN Web inline-style rings)
```js
document.addEventListener('focus', (e) => {
  const el = e.target;
  if (el && el.style) {
    el.style.setProperty('outline', 'none', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
  }
}, true /* capture phase */);
```
Guard with `window.__kkFocusListenerBound` to prevent duplicate listeners on hot-reload.

### Layer 3 — Head MutationObserver (keeps our style tag last in `<head>`)
```js
const reorderKkStyle = () => {
  const s = document.getElementById('kk-global-focus-reset');
  if (s && document.head.lastChild !== s) document.head.appendChild(s);
};
new MutationObserver(reorderKkStyle).observe(document.head, { childList: true });
```
Guards with `window.__kkHeadObserverBound`. Fires rarely (only when new `<style>` tags are inserted into head). Prevents any RN Web component style from ever being later in the cascade than ours.

### Layer 4 — Body style MutationObserver (handles JS-applied inline outline/box-shadow)
Watches for `style` attribute changes on all elements; strips both `outline` AND `box-shadow` when either is non-none. Excludes form controls. Earlier version only checked `outline` — box-shadow was silently skipped.

### Layer 5 (architecture) — Replace focusable dismiss targets with non-focusable Views
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
- **Fresh load looks clean:** The blue ring only appears after a real click/keyboard focus or hover. Fresh-load screenshots show no ring — don't conclude "fixed" from a clean screenshot.
- **Box-shadow gap:** Some browsers paint the focus/hover ring via `box-shadow` on plain `<div>`s, not `outline`. Always reset BOTH.
- **CSS cascade ordering:** Our `!important` hover rule can be overridden by a later `!important` rule with equal specificity — this is why the head MutationObserver (Layer 3) is essential.

**Why:** Per-element `outlineStyle:'none'` in JSX style prop applies only to the element's initial inline style; RN Web may overwrite it post-render via JS. The JS event listener with `setProperty(..., 'important')` cannot be overridden by anything. The head observer solves the cascade ordering problem for class-based hover styles.

**How to apply:** Whenever adding a full-screen or viewport-spanning interactive overlay (drawer scrim, modal backdrop), use `View` + responder instead of `Pressable`. Always include all four layers in `injectFocusReset()`.
