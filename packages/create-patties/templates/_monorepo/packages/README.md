# packages/

Shared code for this Bun workspace. Create a package per shared concern
(e.g. `packages/ui`, `packages/db`) with its own `package.json`, then depend
on it from an app under `apps/*` using the workspace protocol:

```jsonc
// apps/<app>/package.json
{
  "dependencies": {
    "@{{name}}/ui": "workspace:*"
  }
}
```

Bun resolves `workspace:*` to the local package and runs scripts
topologically with `bun --filter`. This monorepo is intentionally
Bun-workspaces-only — no Turborepo / Nx.
