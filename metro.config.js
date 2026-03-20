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

const blockedDirs = [".cache", "attached_assets"];

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    "react-native-reanimated": path.resolve(__dirname, "stubs/react-native-reanimated.js"),
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
