---
name: freeport-async IPv6 fix
description: Replit container can't bind to IPv6 wildcard (::), causing expo startup to hang; fix is in node_modules/freeport-async/index.js
---

# freeport-async / Expo startup hang on IPv6

## The rule
After every `bun install` or dependency reinstall, re-apply the patch to `node_modules/freeport-async/index.js`.

## Why
Bun on this Replit container fails to bind `net.createServer()` to `host: null` (which maps to `::`, the IPv6 wildcard). freeport-async's `testPortAsync` catches all errors via `server.on('error')` and fulfills with `false`, meaning it considers every port "occupied" for a non-EADDRINUSE reason. Expo calls `freePortAsync(5000, { hostnames: [null] })` — every single port from 5000→65535 returns false, the recursive scanner runs through all 60k+ ports and the process hangs (stays alive but never opens port 5000, so the workflow times out with DIDNT_OPEN_A_PORT).

## How to apply
In `node_modules/freeport-async/index.js`, change `testPortAsync`'s error handler from fulfilling `false` on all errors to only fulfilling `false` on `EADDRINUSE` — all other errors (IPv6 unavailable, EADDRNOTAVAIL, etc.) should fulfill `true` (port is free). Also add a `port > 65535` guard at the top of `testPortAsync` and `availableAsync`, and a bounds check in `freePortRangeAsync` to reject cleanly instead of throwing a RangeError at port 65536.
