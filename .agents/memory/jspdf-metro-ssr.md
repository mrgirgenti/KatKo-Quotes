---
name: jspdf / browser-only libs in Metro SSR
description: Why jspdf (and similar browser libs with a Node "main") break the Expo SSR/node bundle, and how to force the ESM build via resolver.resolveRequest.
---

# Browser-only libs (jspdf) in this Expo SSR/Metro app

**Rule:** A browser-only lib whose package `"main"` is a *Node* build can break the
Metro bundle even if you only ever call it client-side. In this app a route's
`import('jspdf')` (even a lazy dynamic import) is bundled/transformed for BOTH the
web client bundle AND the SSR `expo-router/node/render.js` bundle. The SSR/node
bundle resolves `"main"` → `jspdf.node.min.js`, whose AMD-style
`require(["html2canvas"], t)` Metro's transformer rejects → "Invalid call …
require([…])" → `Bundling failed … node/render.js`. jspdf's `"module"`/`"browser"`
fields point to `jspdf.es.min.js`, which uses plain `import("html2canvas")` and
transforms cleanly.

**Fix:** force the bare specifier to the ESM build with a Metro
`resolver.resolveRequest` override:
```js
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "jspdf")
    return { type: "sourceFile", filePath: path.resolve(__dirname, "node_modules/jspdf/dist/jspdf.es.min.js") };
  return (originalResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};
```

**Why not extraNodeModules:** `extraNodeModules` is only a *fallback* — consulted
when normal node_modules resolution FAILS. It does NOT override a real installed
package, so aliasing `jspdf` there is a silent no-op (the repo's
react-native-reanimated stub works only because that pkg isn't installed).
`resolveRequest` has top precedence and is the reliable override.

**How to apply:** any new browser-only dependency with a Node `"main"` that throws
a Metro transform error during `node/render.js` bundling → redirect its specifier
to the ESM/browser dist via `resolveRequest`. Restart the workflow (metro.config
changes need a restart) and clear caches if resolution looks stale.
