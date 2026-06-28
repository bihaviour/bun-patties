---
spec: ui/54-tabs
title: Tabs
status: completed
island: true
peer_deps: ["@radix-ui/react-tabs"]
last_reviewed: 2026-05-23
---

# Tabs

## Purpose

Tabbed panels. Mirrors shadcn `Tabs`. Built on `@radix-ui/react-tabs`.

## Island model

`island: true`. Active tab and focus management require JS. SSR renders the `defaultValue` tab's panel so no-JS users see content.

## Peer dependencies

- `@radix-ui/react-tabs@^1.1`

## Public API

```ts
export const Tabs: typeof Radix.Root
export function TabsList(props: Radix.TabsListProps & { className?: string }): JSX.Element
export function TabsTrigger(props: Radix.TabsTriggerProps & { className?: string }): JSX.Element
export function TabsContent(props: Radix.TabsContentProps & { className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- A URL-driven variant is documented (sync tab to query param via island effect) but not exported by default.

## Acceptance criteria

- SSR shows the `defaultValue` panel.
- Arrow keys move focus between triggers; `Enter`/`Space` activate.
- Switching tab updates the visible panel.
