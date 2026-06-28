---
spec: ui/38-pagination
title: Pagination
status: completed
island: false
peer_deps: ["lucide-react"]
last_reviewed: 2026-05-23
---

# Pagination

## Purpose

Link-based page navigation. Mirrors shadcn `Pagination`.

## Island model

`island: false`. Pages are `<a href>` links to server-rendered routes — the canonical Patties pattern.

## Peer dependencies

- `lucide-react@^0.400`

## Public API

```ts
export function Pagination(props: React.ComponentProps<"nav">): JSX.Element
export function PaginationContent(props: React.ComponentProps<"ul">): JSX.Element
export function PaginationItem(props: React.ComponentProps<"li">): JSX.Element
export function PaginationLink(props: { isActive?: boolean; size?: ButtonSize } & React.ComponentProps<"a">): JSX.Element
export function PaginationPrevious(props: React.ComponentProps<"a">): JSX.Element
export function PaginationNext(props: React.ComponentProps<"a">): JSX.Element
export function PaginationEllipsis(props: React.ComponentProps<"span">): JSX.Element

export const island = false
```

## Patties adjustments

- All items are anchors — no `<button>` variants ship by default. For SPA-style paging, userland wraps with their router-link.
- `aria-current="page"` on the active link.

## Acceptance criteria

- Renders as `<nav aria-label="pagination"><ul>…</ul></nav>`.
- Works with JS disabled.
- Bundle audit: zero JS.
