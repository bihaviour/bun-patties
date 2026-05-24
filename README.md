<p align="center">
  <img src="./bun+patties-banner.png" alt="Bun + Patties" />
</p>

# Bun + Patties

Patties is a Bun-native full-stack meta-framework with React for UI and `Bun.serve` for HTTP. It is intentionally built around Bun primitives — `Bun.serve`, `Bun.Glob`, `Bun.build`, `bun --hot` — rather than as a Node-era framework with a Bun adapter. The goal is a smaller, more legible architecture that treats Bun as the foundation instead of a faster place to run old assumptions.

## Install

```sh
bun add patties react react-dom
```

## Quick start

```ts
import { createRenderer, createRouter, startServer } from "patties"

const renderer = createRenderer({ dev: true })
const { routes, fallback } = await createRouter({
  appDir: import.meta.dir + "/app",
  renderer,
})

startServer({ routes, fallback, dev: true })
```

Drop files into `app/routes/` for pages and API handlers, and into `app/islands/` for components you want hydrated on the client.

## CLI

```sh
patties dev               # bun --hot dev server (use --cold for bun --watch)
patties build             # production bundle
patties build --target edge
```

See `patties --help` for all flags.

## What's in the box

- Filesystem routing compiled to Bun route patterns
- React server rendering via `renderToReadableStream`
- Client islands with on-demand hydration
- HMR over a small WebSocket layer
- Build pipeline that inlines route + island manifests for portable Bun / edge output
- Middleware composition, typed context, config + secrets loading
- Optional AI primitives (agents, tools, jobs) and `AGENTS.md` generation
- Plugin system

## Background

Read the longer write-up: [_Bun, Patties, and Fries: A Complete Meal for the Bun-Native Web Stack_](https://medium.com/bihaviour/bun-patties-and-fries-a-complete-meal-for-the-bun-native-web-stack-01bcf977f564).
