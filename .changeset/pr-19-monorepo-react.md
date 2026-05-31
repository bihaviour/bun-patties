---
"patties": patch
---

Make dev-server bin + React resolution workspace-aware so Bun-workspace monorepos (hoisted root `node_modules`) load a single copy of React and don't crash SSR with "Invalid hook call". Flat-app resolution is unchanged.
