# Bun-native rule

Patties is intentionally built on Bun primitives. Do not introduce Node-era replacements when a Bun primitive exists.

- HTTP server: `Bun.serve` only. No `node:http`, no Express/Hono/Fastify wrappers inside the framework core.
- Filesystem discovery: `Bun.Glob`. No `fast-glob` / `globby` / `chokidar`.
- Bundling: `Bun.build`. No Webpack, Rollup, esbuild, Vite, tsup.
- Dev workflow: `bun --hot` / `bun --watch`. The dev layer only coordinates HMR over WebSocket — it is not a second runtime.
- Package manager / scripts: `bun` / `bunx`, not `npm` / `npx` / `yarn` / `pnpm`.
- Tests: `bun test`. No Jest / Vitest.

If you think you need an exception, surface it before adding the dependency.
