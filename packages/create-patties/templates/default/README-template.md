# {{name}}

Built with [Patties](https://github.com/bihaviour-ai/bun-patties-framework) — a
Bun-native full-stack meta-framework.

<!-- if:type=fullstack -->
## What you got

A full-stack Patties app:

- `app/routes/index.tsx` — server-rendered page that mounts an island.
- `app/islands/TodoApp.tsx` — `useState`-based todo list, hydrated in the browser.
- `app/routes/api/health.ts` — a JSON API route (`GET /api/health` → `{ ok: true }`).
- `app/server.ts` — dev entry that wires the router into `Bun.serve`.
<!-- /if -->
<!-- if:type=frontend -->
## What you got

A frontend Patties app:

- `app/routes/index.tsx` — server-rendered page that mounts an island.
- `app/islands/TodoApp.tsx` — `useState`-based todo list, hydrated in the browser.
- `app/server.ts` — dev entry that wires the router into `Bun.serve`.
<!-- /if -->
<!-- if:type=backend -->
## What you got

A backend Patties app — API routes, no React UI:

- `app/routes/api/health.ts` — `GET /api/health` → `{ ok: true }`.
- `app/routes/api/todos.ts` — a sample in-memory `GET` / `POST` resource.
- `app/server.ts` — dev entry that wires the router into `Bun.serve`.
<!-- /if -->

## Run it

```sh
bun install      # if you used --no-install
<!-- if:monorepo=yes -->bun --filter {{app_name}} dev # → http://localhost:3000<!-- /if -->
<!-- if:monorepo=no -->bunx patties dev # → http://localhost:3000<!-- /if -->
```

<!-- if:ui=yes -->
## Patties UI

Styled components are stamped into `app/components/ui/` (`button`, `card`,
`input`, `label`) with shared helpers in `app/components/ui/_internal/` and
design tokens in `app/styles/tokens.css`.

Add more components with `patties add <component>` (e.g. `patties add dialog`),
preview first with `patties view <component>`, or ask your coding agent — see
the agent section below.

### Styling

Patties bundles no CSS, so the starter wires Tailwind for you:

- `app/styles/app.css` is pre-wired (`@import "tailwindcss"` + the token mapping).
- `bun run css` compiles it to `app/styles/app.generated.css` (gitignored).
  `bun run dev` and `bun run build` run this first, so the app is styled on boot.
- `app/routes/api/styles.ts` serves the compiled sheet and `app/components/_head.tsx`
  links it. Each page re-exports that `head` —
  `export { head } from "../components/_head.tsx";` — so add the line to new pages.

While iterating on classNames, run the watcher in a second terminal so the sheet
rebuilds as you save:

```sh
bun run css:watch
```
<!-- /if -->

## Project layout

<!-- if:monorepo=yes -->
```
apps/
  {{app_name}}/
    app/
      routes/        # filesystem-routed pages and API handlers
      islands/       # interactive client components
      server.ts      # dev entry — wires the router into Bun.serve
    patties.config.ts
    package.json
packages/            # shared workspace packages
package.json         # Bun workspace root
```

This is a Bun workspace. Run app scripts with `bun --filter <app> <script>`
(e.g. `bun --filter {{app_name}} build`) or from inside `apps/{{app_name}}/`.
Add more apps under `apps/` and shared code under `packages/`.
<!-- /if -->
<!-- if:monorepo=no -->
```
app/
  routes/        # filesystem-routed pages and API handlers
  islands/       # interactive client components
  server.ts      # dev entry — wires the router into Bun.serve
patties.config.ts
package.json
tsconfig.json
```
<!-- /if -->

## Build for production

```sh
<!-- if:monorepo=yes -->bun --filter {{app_name}} run build<!-- /if -->
<!-- if:monorepo=no -->bun run build<!-- /if -->
```

Build artifacts land in `.patties/`. Run the server bundle with
`bun .patties/server/server-entry.js`.

<!-- if:target=container -->
## Deploy — container

A `Dockerfile` (+ `.dockerignore`) is included for the `bun` runtime:

```sh
docker build -t {{name}} .
docker run -p 3000:3000 {{name}}
```
<!-- /if -->
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

<!-- if:agent=claude -->
## Claude Code is set up

`CLAUDE.md` describes the framework conventions. The `/patties` skill
(`.claude/skills/patties/`) adds components and scaffolds feature patterns
(auth, CRM, task board, dashboard, …). For a guided first scaffold, open a new
terminal and run:

```sh
claude --permission-mode plan "/patties-init"
```
<!-- /if -->
<!-- if:agent=codex -->
## Codex is set up

`AGENTS.md` describes the framework conventions and links
`.codex/rules/patties-patterns.md`, which tells Codex how to add components and
scaffold feature patterns. Open Codex and ask it to scaffold a pattern.
<!-- /if -->
<!-- if:agent=none -->
## No agent

Add UI components with `patties add <component>`. Feature patterns
(auth, CRM, dashboard, …) are agent-driven — scaffold a project with
`--agent claude` or `--agent codex` to get the `/patties` skill.
<!-- /if -->

## Learn more

- Patties docs: https://bun-patties.com
- Bun: https://bun.sh
- React 19: https://react.dev
