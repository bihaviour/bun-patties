# {{name}}

Built with Patties — Bun-native full-stack meta-framework.

> This file is read by Codex CLI and other AGENTS.md-aware tools. Patties also
> auto-regenerates a live inventory at the bottom of this file on `patties
> build`. Hand-edited sections **above** the `<!-- patties:generated -->`
> marker are preserved across regenerations; everything below is owned by
> the generator.

## Stack

Bun runtime · `Bun.serve({ routes })` dispatcher · React 19 renderer
(`renderToReadableStream` server, `hydrateRoot` client) · `{{deploy}}` deploy
· `{{target}}` target.

## Rules

### Bun-native first

This project runs on Bun. Reach for Bun primitives first; do not
reintroduce Node-era replacements just because a familiar library
provides them.

- HTTP server: `Bun.serve` (the framework wires it). Do not add Express,
  Fastify, Hono, or `node:http`.
- Filesystem discovery: `Bun.Glob`. Do not pull in `fast-glob`, `globby`,
  or `chokidar`.
- Bundling: `Bun.build` (run for you by `patties build`). Do not add
  Webpack, Rollup, esbuild, Vite, or tsup.
- File I/O: `Bun.file(path).text() / .json() / .bytes()` and
  `Bun.write(path, data)` before reaching for `node:fs`.
- Hashing / crypto: `Bun.CryptoHasher`, `Bun.password`.
- Databases: `bun:sqlite`, `Bun.sql` (Postgres), `Bun.RedisClient`,
  `Bun.S3Client` before npm wrappers.
- Tests: `bun test`. Do not add Jest or Vitest.
- Package manager: `bun` / `bunx`. Do not use `npm` / `npx` / `yarn` /
  `pnpm`.

### Web-standards boundary

Handlers stay close to web standards. Do not paper over them with a
custom request abstraction.

- Handler signature: `(req: Request, ctx: PattiesContext) => Response | Promise<Response>`.
  Standard web `Request` in, standard web `Response` out.
- The only framework-added affordance is `PattiesContext` (`params`,
  `cookies`, `env`, `vars`, `url`, `json()`, `html()`, `redirect()`).
  Keep it thin — do not expect Next-style request abstractions.
- No Hono / Express / Fastify types. Write the standard
  `Middleware = (req, ctx, next) => Promise<Response>` instead of
  Hono's `MiddlewareHandler`.
- React SSR uses `renderToReadableStream`. Do not use `renderToString`
  or `renderToPipeableStream`.
- Client hydration uses `hydrateRoot`. Do not use `ReactDOM.render`.

### Filesystem routing

Routes are discovered from `app/routes/`:

| File | URL |
|---|---|
| `app/routes/index.tsx` | `/` |
| `app/routes/about.tsx` | `/about` |
| `app/routes/hotels/index.tsx` | `/hotels` |
| `app/routes/hotels/[city].tsx` | `/hotels/:city` |
| `app/routes/api/revenue.ts` | `/api/revenue` |
| `app/routes/_internal.tsx` | (private — never routed) |

- Page routes are `.tsx` files that default-export a React component.
- API routes are `.ts` files that export named `GET` / `POST` / `PUT` /
  `DELETE` / `PATCH` handlers. Default exports in `.ts` files are
  reserved.
- Dynamic segments use `[param]` in the filename; values arrive on
  `ctx.params`.
- Files starting with `_` are private and never routed.
- Reserved URL prefixes: `/__patties_*` and `/_patties/*`.

### Islands

Server-side rendering is the default. Islands are the parts that need
browser interactivity.

- Live in `app/islands/*.tsx`. Files outside this directory never ship
  to the browser.
- Mark with `"use client";` at the top and default-export a React
  component.
- Import from a route file:
  ```tsx
  import TodoApp from "../islands/TodoApp.tsx";
  ```
- **Today's gap:** `bun dev` does SSR only — island click handlers are
  dead under `bun dev`. Run `bun run build && bun start` to exercise
  interactivity. Full dev-mode hydration lands with framework spec 18.

### Build-time discovery

Routes, islands, agents, and tools are discovered at build time, not
request time. The production server bundle has the route table inlined
and never calls `Bun.Glob` at runtime. Dev mode is the exception (it
re-scans on file change to drive HMR). Do not write code that scans
`app/**` at request time.

### Optional AI dependency

`@anthropic-ai/sdk` is an optional peer dependency. Apps that do not
use `app/agents/`, `app/tools/`, or `app/jobs/` must still install and
run without it.

- Never `import "@anthropic-ai/sdk"` at the top level of a route or
  middleware. Wrap it in a dynamic `import()` inside the function that
  needs it, or accept an `AnthropicLike` instance from
  `PattiesContext`.

## CLI

The project CLI is `patties`, exposed through `package.json#scripts`.

- `bun dev` — start the dev server with HMR (`patties dev`). SSR-only
  today; see the Islands rule.
- `bun run build` — produce a production bundle in `.patties/`
  (`patties build`).
- `bun start` — run the last production build (`patties start`). Use
  this to exercise island hydration until dev-mode hydration lands.
- `patties deploy` — build and dispatch to a deploy plugin declared
  in `patties.config.ts#plugins`. Pass `--skip-build` to reuse an
  existing `.patties/`.
- `patties secret set <KEY> [value]` / `get` / `list` / `rm` /
  `doctor` — dev-only secret management via the OS keychain. In
  production, secrets come from your host's secrets surface.

Global flags: `--cwd <path>`, `--config <path>`, `--verbose`,
`--version` / `-v`, `--help` / `-h`.

<!-- patties:generated -->
<!-- The block below is rewritten by `patties build`. Do not edit by hand. -->
<!-- /patties:generated -->
