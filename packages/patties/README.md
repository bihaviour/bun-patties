<p align="center">
  <img src="./bun+patties-banner.png" alt="Bun + Patties" />
</p>

# Bun + Patties

Patties is a Bun-native full-stack meta-framework with React for UI and `Bun.serve` for HTTP. It is intentionally built around Bun primitives — `Bun.serve`, `Bun.Glob`, `Bun.build`, `bun --hot` — rather than as a Node-era framework with a Bun adapter. The goal is a smaller, more legible architecture that treats Bun as the foundation instead of a faster place to run old assumptions.

## Quick start

```sh
bunx create-patties@latest my-app
cd my-app
bunx patties dev
```

By default the scaffold includes a `CLAUDE.md` for Claude Code (rules +
auto-generated manifest fenced into a marked section). Pick a different
agent platform with `--template`:

```sh
bunx create-patties@latest my-app --template codex   # .codex/ + AGENTS.md
bunx create-patties@latest my-app --template none    # no agent file
```

## Manual setup

```sh
bun add patties react react-dom
```

```ts
import { setupDevClient } from "patties/dev"
import { createRenderer } from "patties/render"
import { createRouter } from "patties/router"
import { startServer } from "patties/server"

const appDir = import.meta.dir + "/app"
const devClient = await setupDevClient({ appDir })
const renderer = createRenderer({ manifest: devClient.manifest, dev: true })
const { routes, fallback } = await createRouter({ appDir, renderer })

startServer({
  routes: { ...devClient.routes, ...routes },
  fallback,
  dev: true,
})
```

Drop files into `app/routes/` for pages and API handlers, and into
`app/islands/` for components you want hydrated on the client. Wrap each
island use site in `<Island name="MyIsland">…</Island>` (from
`patties/render`) so the SSR markers are emitted and the client runtime
hydrates them.

## Agent manifest

`patties dev` / `patties build` regenerate a route + island + agent +
tool + job + middleware + env inventory. It's spliced between
`<!-- patties:manifest-start -->` … `<!-- patties:manifest-end -->` so
rules and notes above the section are preserved across regenerations.
Default target is `CLAUDE.md`; override with `config.agentsMd.path`
(string or `string[]`) in `patties.config.ts`.

## CLI

```sh
patties dev               # bun --hot dev server (use --cold for bun --watch)
patties build             # production bundle
patties build --target edge
patties deploy            # build then dispatch to an installed deploy plugin
patties secret            # manage dev-time secrets in the OS keychain
```

UI catalog (via the optional `patties-ui` package):

```sh
patties ui init           # scaffold tokens + _internal helpers (once)
patties add button card   # stamp components into app/components/ui/
patties view button       # print a component's source before stamping
patties update button     # re-stamp from the catalog after showing the diff
patties migrate           # codemods: radix imports / RTL logical properties
patties ui build          # emit a fetchable registry.json (for registry authors)
```

See `patties --help` for all flags.

## What's in the box

- Filesystem routing compiled to Bun route patterns
- React server rendering via `renderToReadableStream`
- Client islands with on-demand hydration
- HMR over a small WebSocket layer
- Build pipeline that inlines route + island manifests for portable Bun / edge output
- Single-file `--compile` binaries (`adapter.bun.compile`) with app/public + client chunks embedded via `Bun.embeddedFiles` — no `dist/` sidecar to ship
- Per-request correlation IDs on `ctx.requestId`, echoed as `X-Request-Id`; dev responses also carry `Server-Timing: total;dur=<ms>`
- Middleware composition, typed context, config + secrets loading
- Optional AI primitives (agents, tools, jobs) and agent-manifest generation (default `CLAUDE.md`, configurable)
- Plugin system

## Background

Read the longer write-up: [_Bun, Patties, and Fries: A Complete Meal for the Bun-Native Web Stack_](https://medium.com/bihaviour/bun-patties-and-fries-a-complete-meal-for-the-bun-native-web-stack-01bcf977f564).
