# Framework Overview

Patties centers its runtime on Bun primitives instead of adapting Node-era
framework assumptions. The public entrypoints exposed from `src/index.ts`
include:

- `createRenderer` for React server rendering
- `createRouter` for filesystem-driven route discovery
- `createServer` and `startServer` for serving compiled routes
- `build` for production bundling
- `defineConfig` for project configuration
- AI, middleware, plugin, and `AGENTS.md` helpers

At a high level, a Patties app is composed from:

- `app/routes/` for pages and API handlers
- `app/islands/` for client-hydrated components
- `app/middleware.ts` for request middleware
- `app/agents/`, `app/tools/`, and `app/jobs/` for optional AI features

See also:

- [Routing](./routing.md)
- [AI and Agents](./ai-and-agents.md)
