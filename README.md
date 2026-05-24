# patties

Bun-native full-stack meta-framework with React for UI and `Bun.serve` for HTTP.

Phase 0 — see `agent_specs/framework/` in the docs repo for the full specs.

## Quick start

```ts
import { startServer, createRouter, createRenderer } from "patties"

const renderer = createRenderer({ dev: true })
const { routes, fallback } = await createRouter({
  appDir: import.meta.dir + "/app",
  renderer,
})

startServer({ routes, fallback, dev: true })
```
