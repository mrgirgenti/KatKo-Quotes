---
name: Static image assets in Expo SSR web
description: How to bundle/reference local image files so they work in this Expo Router output:server web app.
---

# Local image assets (logos, etc.)

`Image.resolveAssetSource(require('...'))` is **not available** in react-native-web during SSR (`Image.resolveAssetSource is undefined` → 500 on every route). Do not use `require()`-based asset resolution for images that need a URI string.

**Why:** The app renders on a Node server (`web.output: "server"`); the web build of `Image` has no `resolveAssetSource`, and it throws at module-load time when used in a top-level `const`, taking down the whole page.

**How to apply:** Put the file in the project-root `public/` directory (Expo serves it at the web root) and reference it by URL path, e.g. `const LOGO_URI = '/katalyst-logo.png';`. A plain string works in `<Image source={{ uri }} />` and `Image.getSize(uri)`. Keep filenames free of `:` and `()` (they break require paths and some tooling). Note: react-native-web sets the image `src` client-side after hydration, so the path will NOT appear in SSR HTML — verify by curling the static file (`/katalyst-logo.png` → 200 image/png), not by grepping the page HTML.
