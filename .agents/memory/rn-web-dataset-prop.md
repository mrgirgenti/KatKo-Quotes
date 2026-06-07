---
name: RN-web dataSet prop TS workaround
description: How to render data-* attributes on react-native-web Touchables without TypeScript errors
---

# RN-web `dataSet` prop

react-native-web renders a `dataSet` prop as `data-*` attributes in the DOM (e.g. `dataSet={{ kkNav: '' }}` → `data-kk-nav=""`), which lets you target elements from injected web CSS. This is the clean way to scope global CSS to specific RN components.

**Problem:** RN's TypeScript types for `TouchableOpacity` / `View` props do NOT declare `dataSet`, so `dataSet={...}` fails `tsc` with "Property 'dataSet' does not exist".

**Fix:** Don't pass `dataSet=` directly. Define an `any`-typed object holding the prop and spread it:
```ts
export const KK_NAV_DATASET: any = { dataSet: { kkNav: '' } };
// usage:
<TouchableOpacity {...KK_NAV_DATASET} ... />
```
Spreading an `any` bypasses prop-name checking; passing `dataSet={someAny}` does NOT (the unknown prop name still errors).

**Why:** Same reason the codebase casts other web-only style props like `outlineStyle`/`background` with `as any` — RN types lag web-only features.

**How to apply:** Any time you need a `data-*` hook on an RN-web element (focus-ring resets, scoped CSS, e2e selectors), use the spread-an-any pattern.
