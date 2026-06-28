---
spec: framework/11-agents-md-generator
title: AGENTS.md Generator
status: draft
phase: 3
file: runs during `patties build` and on `patties dev` boot
last_reviewed: 2026-05-23
---

# Spec 11 — AGENTS.md Generator

## Purpose

Emit `AGENTS.md` at the project root on every build. The file tells any AI agent (Claude Code, etc.) exactly how this specific app is structured, so it can add features without asking "where does this go?".

## Generated sections

1. **Route map** — file path → URL pattern → HTTP methods.
2. **Island inventory** — component name → props interface → hydration target.
3. **Agent directory** — agent name → tools available → trigger conditions.
4. **Tool directory** — tool name → input schema (Zod → JSON Schema) → output description.
5. **Middleware chain** — order of execution + a one-line summary parsed from a doc comment.
6. **Environment variables** — name, required?, what it configures (from `patties.config.ts`).

## Public surface

```ts
export interface AgentsMdDocument {
  routes: RouteSummary[]
  islands: IslandSummary[]
  agents: AgentSummary[]
  tools: ToolSummary[]
  middleware: MiddlewareSummary[]
  env: EnvVarSummary[]
}

export async function generateAgentsMd(appDir: string, config: ResolvedConfig): Promise<string>
```

The string is the rendered Markdown; the caller writes it to `AGENTS.md`.

## Behavior

1. Reuse the route scanner ([02b](../phase-0/02b-filesystem-router.md)) for the route map.
2. Statically analyze islands for prop type names (best-effort via the TS compiler API; fallback to "see source").
3. Import each agent and tool module to read its `defineAgent` / `defineTool` config (these are pure data structures). The import runs inside a **`Bun.spawn`-ed subprocess** dedicated to AGENTS.md generation:
   - The subprocess is a tiny script that `import()`s the user module, posts the extracted config as JSON to stdout, and exits.
   - Communication is JSON-over-stdio (`stdio: ["ignore", "pipe", "pipe"]`); the parent reads `proc.stdout` and waits on `proc.exited`.
   - Side effects at module load (DB connections, HTTP calls, `process.exit`) are contained — the subprocess dies when generation finishes.
   - A module whose top-level throws produces a generator error naming the file and the cause from `proc.stderr`, not a crashed build.
   - Workers were considered but rejected: subprocess isolation matches better with the no-shared-state requirement and is simpler to kill on timeout.
4. Translate Zod schemas to JSON Schema for the tool table.
5. Apply plugin `onAgentsMdGenerate` hooks ([09](../phase-4/09-plugins.md)) in order.
6. Render with a deterministic template — same input always produces the same Markdown (important for diffs in PRs).
7. Write the result with `Bun.write("AGENTS.md", markdown)`. Never `node:fs.writeFile`.

## Acceptance criteria

- A fresh `bunx create-patties` app produces an `AGENTS.md` listing the seed route and no agents.
- Adding a tool and rebuilding adds exactly one row to the tool table.
- Two consecutive builds with no source change produce byte-identical files.
