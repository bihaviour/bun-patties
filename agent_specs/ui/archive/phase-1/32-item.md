---
spec: ui/32-item
title: Item
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Item

## Purpose

Generic list/row primitive — icon + content + action layout. Mirrors shadcn `Item`.

## Island model

`island: false`. Layout-only.

## Peer dependencies

None.

## Public API

```ts
export function Item(props: { variant?: "default" | "muted"; size?: "default" | "sm"; className?: string } & React.ComponentProps<"div">): JSX.Element
export function ItemMedia(props: { variant?: "default" | "icon" | "image" } & React.ComponentProps<"div">): JSX.Element
export function ItemContent(props: React.ComponentProps<"div">): JSX.Element
export function ItemTitle(props: React.ComponentProps<"div">): JSX.Element
export function ItemDescription(props: React.ComponentProps<"div">): JSX.Element
export function ItemActions(props: React.ComponentProps<"div">): JSX.Element
export function ItemHeader(props: React.ComponentProps<"div">): JSX.Element
export function ItemFooter(props: React.ComponentProps<"div">): JSX.Element
export function ItemGroup(props: React.ComponentProps<"div">): JSX.Element
export function ItemSeparator(props: React.ComponentProps<"div">): JSX.Element

export const island = false
```

## Patties adjustments

- `asChild` is supported on `Item` so it can render as a `<a>` or `<button>` semantically without losing the layout.

## Acceptance criteria

- Snapshot tests for each variant and size.
- Bundle audit: zero JS.
