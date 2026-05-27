# Bun-native rule

This project runs on Bun. Reach for Bun primitives first; do not
reintroduce Node-era replacements just because a familiar library
provides them.

- **HTTP server:** `Bun.serve`. The framework already wires it — do
  not add Express / Fastify / Hono / `node:http`.
- **Filesystem discovery:** `Bun.Glob`. Do not pull in `fast-glob`,
  `globby`, or `chokidar`.
- **Bundling:** `Bun.build`. The framework runs it for you at
  `patties build`; you should not add Webpack / Rollup / esbuild /
  Vite / tsup.
- **File I/O:** `Bun.file(path).text()` / `.json()` / `.bytes()` and
  `Bun.write(path, data)` before reaching for `node:fs`.
- **Hashing / crypto:** `Bun.CryptoHasher`, `Bun.password`. Avoid
  `crypto` / `bcrypt` unless you have a real reason.
- **Databases:** `bun:sqlite`, `Bun.sql` (Postgres), `Bun.RedisClient`,
  `Bun.S3Client` before reaching for npm wrappers.
- **Environment:** `Bun.env`. The framework injects the public subset
  declared in `patties.config.ts#env.public`; secrets live in the OS
  keychain (see `patties-cli` skill).
- **Tests:** `bun test`. Do not add Jest or Vitest.
- **Package manager:** `bun` / `bunx`. Do not run `npm` / `npx` /
  `yarn` / `pnpm` in this project.

If you genuinely need a Node-only library, that's fine — Bun's Node
compatibility is strong. But default to Bun primitives.
