---
spec: ui/07-breadcrumb
title: Breadcrumb
status: completed
island: false
peer_deps: ["lucide-react"]
last_reviewed: 2026-05-23
---

# Breadcrumb

## Purpose

Hierarchical navigation trail. Mirrors shadcn `Breadcrumb`.

## Island model

`island: false`. Anchor-tag based navigation; no client JS.

## Peer dependencies

- `lucide-react@^0.400` (ChevronRight, Ellipsis)

## Public API

```ts
export function Breadcrumb(props: React.ComponentProps<"nav">): JSX.Element
export function BreadcrumbList(props: React.ComponentProps<"ol">): JSX.Element
export function BreadcrumbItem(props: React.ComponentProps<"li">): JSX.Element
export function BreadcrumbLink(props: React.ComponentProps<"a"> & { asChild?: boolean }): JSX.Element
export function BreadcrumbPage(props: React.ComponentProps<"span">): JSX.Element
export function BreadcrumbSeparator(props: React.ComponentProps<"li">): JSX.Element
export function BreadcrumbEllipsis(props: React.ComponentProps<"span">): JSX.Element

export const island = false
```

## Patties adjustments

- The default root is `<nav aria-label="breadcrumb">` — never an `<ol>`-only tree, for screen-reader clarity.
- `BreadcrumbLink` uses native `<a>`; integration with Patties router-link components is left to userland.

## Acceptance criteria

- Renders `<nav aria-label="breadcrumb"><ol>…</ol></nav>` shape.
- Current page renders as `<span aria-current="page">`, not a link.
- Bundle audit: zero JS.
