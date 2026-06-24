const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

// Patch fs.watch to silently ignore directories that can't be watched
// (e.g. attached_assets is a Replit virtual filesystem that throws EINVAL)
const _originalWatch = fs.watch;
fs.watch = function (filename, options, listener) {
  try {
    return _originalWatch.call(this, filename, options, listener);
  } catch (err) {
    if (err.code === "EINVAL" || err.code === "ENOENT" || err.code === "ENOSPC") {
      const { EventEmitter } = require("events");
      const noop = new EventEmitter();
      noop.close = () => {};
      return noop;
    }
    throw err;
  }
};

const config = getDefaultConfig(__dirname);

config.watchFolders = (config.watchFolders || []).filter(
  (folder) =>
    !folder.includes(".bun") && !folder.includes("attached_assets")
);

// .expo/types — Expo Router auto-regenerates router.d.ts while Metro is
// bundling; without this, Metro's file-watcher detects the write mid-compile
// and resets the bundle back to 0/1, adding ~20–30 s to every cold start.
// .agents / .local — Replit tooling writes memory/task/session files here
// continuously; they contain no JS and must not trigger bundle invalidations.
const blockedDirs = [".cache", "attached_assets", ".expo/types", ".agents", ".local"];

const originalResolveRequest = config.resolver?.resolveRequest;

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    "react-native-reanimated": path.resolve(__dirname, "stubs/react-native-reanimated.js"),
  },
  // jspdf's "main" is a Node build (jspdf.node.min.js) whose AMD-style
  // `require(["html2canvas"])` cannot be transformed by Metro and breaks the
  // SSR/node bundle. extraNodeModules is only a fallback and does NOT override a
  // real installed package, so redirect the bare "jspdf" specifier to its ESM
  // build here (Metro-transformable). It is only ever executed client-side.
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === "jspdf") {
      return {
        type: "sourceFile",
        filePath: path.resolve(__dirname, "node_modules/jspdf/dist/jspdf.es.min.js"),
      };
    }
    const resolve = originalResolveRequest ?? context.resolveRequest;
    return resolve(context, moduleName, platform);
  },
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
      ? [config.resolver.blockList]
      : []),
    ...blockedDirs.map(
      (dir) =>
        new RegExp(
          path.join(__dirname, dir).replace(/\\/g, "/") + "(/.*)?$"
        )
    ),
  ],
};

module.exports = config;
