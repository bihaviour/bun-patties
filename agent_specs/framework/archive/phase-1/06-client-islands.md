---
spec: framework/06-client-islands
title: Client Islands
status: done
phase: 1
file: client/index.ts
last_reviewed: 2026-05-24
---

# Spec 06 — Client Islands

## Purpose

Hydrate interactive components in the browser using React (`react-dom/client`). Pages are static SSR HTML; islands are the only interactive units. Each island is its own independent React root — there is no whole-page React tree.

## Public surface

```ts
export function createClient(): {
  register(name: string, component: ComponentType): void
  hydrateAll(): void
}
```

The synthetic client entry produced by [04-build](./04-build.md) imports every island and calls `register(name, Component)`, then `hydrateAll()`.

## Behavior

1. `hydrateAll()` queries `[data-island]` markers in the document.
2. For each marker, read `data-island="<name>"` and the adjacent `<script type="application/json" data-props>` blob.
3. Look up the registered component by name and call `hydrateRoot(marker, <Component {...props} />)` from `react-dom/client`. Each marker gets its own root — never `createRoot`, which would discard the SSR markup.
4. Errors during hydration log to `console.error` with the island name; the rest of the page stays alive.

## Constraints

- Islands use only `react` + `react-dom/client`. No global React tree — each island is an independent `hydrateRoot` call.
- Islands must be self-contained — no shared module-level state across islands. Cross-island coordination is a Phase 4 RFC.
- Props must be JSON-serializable. If a component needs a function prop, expose a route handler instead. Non-JSON types (Date, Map, Set, BigInt) require an explicit (de)serializer at the island boundary.

## Bundle-size note

React + `react-dom/client` is ~45KB gzipped. `Bun.build` code-splitting hoists the React runtime into a single shared chunk so multiple islands on one page do not duplicate it. Pages with zero islands ship zero client JS (the synthetic entry short-circuits before importing React).

## Non-goals

- Partial hydration triggered by viewport, idle, or interaction (Phase 4 RFC).
- Cross-island state stores.

## Acceptance criteria

- A counter island marker hydrates with `hydrateRoot` and `useState` works in the browser without a hydration-mismatch warning.
- A page with zero islands ships zero client JS (no React runtime in the bundle).
- A page with multiple islands shares a single React runtime chunk.
- A misspelled `data-island` name logs an error but does not throw out of the page.
