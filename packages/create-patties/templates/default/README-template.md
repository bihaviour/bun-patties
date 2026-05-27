# {{name}}

Built with [Patties](https://github.com/bihaviour-ai/bun-patties-framework) — a
Bun-native full-stack meta-framework.

## What you got

A minimal Patties app: filesystem routing under `app/routes/`, an interactive
island under `app/islands/`, and a dev-mode entry at `app/server.ts`. The
interesting files to open first are `app/routes/index.tsx` (server-rendered
page) and `app/islands/Counter.tsx` (hydrated client island).

## Run it

```sh
bun install     # if you used --no-install
bun dev         # → http://localhost:3000
```

## Try HMR

1. Open `app/routes/index.tsx`, change the heading text, save — the browser
   refreshes.
2. Open `app/islands/Counter.tsx`, change the label or initial count, save —
   the island re-hydrates without dropping your other tabs.

## Project layout

```
app/
  routes/        # filesystem-routed pages and API handlers
  islands/       # interactive client components
  server.ts      # dev entry — wires the router into Bun.serve
patties.config.ts
package.json
tsconfig.json
```

## Build for production

```sh
bun run build
```

Build artifacts land in `.patties/`. Run the server bundle with:

```sh
bun .patties/server/server-entry.js
```

<!-- if:deploy=cloudflare -->
## Deploy

This project is configured for **Cloudflare** deployment. See the
`@patties/deploy-cloudflare` plugin docs for the next steps.
<!-- /if -->
<!-- if:deploy=vercel -->
## Deploy

This project is configured for **Vercel** deployment. See the
`@patties/deploy-vercel` plugin docs for the next steps.
<!-- /if -->
<!-- if:deploy=deno -->
## Deploy

This project is configured for **Deno Deploy**. See the
`@patties/deploy-deno` plugin docs for the next steps.
<!-- /if -->
<!-- if:deploy=netlify -->
## Deploy

This project is configured for **Netlify Edge**. See the
`@patties/deploy-netlify` plugin docs for the next steps.
<!-- /if -->
<!-- if:deploy=bun -->
## Deploy

This project ships as a standalone Bun bundle. Run `bun run build` then
deploy the contents of `.patties/` to any host that runs Bun.
<!-- /if -->

<!-- if:agent=claude -->
## Claude Code is set up

`CLAUDE.md` at the project root describes the framework conventions for Claude
Code. `.claude/settings.json` allow-lists the commands you'll typically need
(`bun`, `bunx`, `patties`). `.claude/hooks/biome-check.sh` runs Biome after
every edit if you install it (`bun add -d @biomejs/biome`).

Launch a session with `claude` in this directory.
<!-- /if -->
<!-- if:agent=codex -->
## Codex is set up

`AGENTS.md` at the project root describes the framework conventions for
Codex CLI and other AGENTS.md-aware tools. Patties regenerates this file on
`patties build` while preserving sections you mark with
`<!-- patties:user --> ... <!-- /patties:user -->`.

Launch a session with `codex` in this directory.
<!-- /if -->

## Learn more

- Patties docs: https://bun-patties.com
- Bun: https://bun.sh
- React 19: https://react.dev
