# {{name}}

Built with [Patties](https://github.com/bihaviour-ai/bun-patties-framework) — a
Bun-native full-stack meta-framework.

<!-- if:scaffold=demo -->
## What you got

An interactive todo demo:

- `app/routes/index.tsx` — server-rendered page that mounts the island.
- `app/islands/TodoApp.tsx` — `useState`-based todo list, hydrated in the
  browser.
- `app/server.ts` — dev entry that wires the router into `Bun.serve`.

## Run it

```sh
bun install      # if you used --no-install
bunx patties dev # → http://localhost:3000
```

Dev mode SSRs the page and hydrates the island, so the todo buttons work
immediately. HMR reloads the browser when you edit a route or island.

## Try editing

1. Open `app/routes/index.tsx`, change the heading text, save. The browser
   reloads (HMR).
2. Open `app/islands/TodoApp.tsx`, change the initial todo list or input
   placeholder, save, and try it — the bundle rebuilds on the next request.

## Remove the demo when you're ready

The todo demo exists to show you state hydration. When you start your real
app, delete it:

```sh
rm app/islands/TodoApp.tsx
```

Then replace `app/routes/index.tsx` with whatever your landing page should
be — a minimal version:

```tsx
export default function Index(): JSX.Element {
	return <main><h1>Hello from {{name}}</h1></main>;
}
```

If you don't need any islands at all, you can also delete the empty
`app/islands/` directory. You can re-scaffold without the demo at any time
using `bunx create-patties@latest <new-name> --blank`.
<!-- /if -->
<!-- if:scaffold=blank -->
## What you got

A minimal hello-world Patties app:

- `app/routes/index.tsx` — server-rendered landing page.
- `app/server.ts` — dev entry that wires the router into `Bun.serve`.

## Run it

```sh
bun install      # if you used --no-install
bunx patties dev # → http://localhost:3000
```

## Add your first interactive feature

Create `app/islands/` and drop in a component that uses `useState` or
`useEffect`. Import it from a route file under `app/routes/` and wrap the
use site in `<Island name="MyIsland">…</Island>` (from `patties/render`)
so the SSR markers are emitted and the client runtime hydrates it.
<!-- /if -->

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
Codex CLI and other AGENTS.md-aware tools. Patties regenerates the
inventory section between `<!-- patties:manifest-start -->` and
`<!-- patties:manifest-end -->` on every `patties dev/build` — everything
outside those markers is yours to edit.

Launch a session with `codex` in this directory.
<!-- /if -->

## Learn more

- Patties docs: https://bun-patties.com
- Bun: https://bun.sh
- React 19: https://react.dev
