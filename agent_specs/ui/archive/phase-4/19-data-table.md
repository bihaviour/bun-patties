---
spec: ui/19-data-table
title: Data Table
status: draft
island: true
peer_deps: ["@tanstack/react-table"]
last_reviewed: 2026-05-23
---

# Data Table

## Purpose

Composed table pattern (sort, filter, paginate, row-select) built on `@tanstack/react-table` and [53-table](./53-table.md). Mirrors shadcn `Data Table` recipe.

## Island model

`island: true`. Sort/filter/pagination/selection are client state.

## Peer dependencies

- `@tanstack/react-table@^8`

## Public API

Like upstream, this is a **recipe**, not a single primitive. The CLI stamps a reference implementation:

```ts
export function DataTable<TData, TValue>(props: {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  initialSorting?: SortingState
  initialColumnFilters?: ColumnFiltersState
  initialPagination?: PaginationState
  className?: string
}): JSX.Element

export const island = true
```

## Patties adjustments

- `data` and `columns` must be JSON-serializable when this is mounted as a top-level island. `columns` with custom `cell` renderers should be defined inside the island module — not passed as props.
- An SSR-first variant: server renders the first page statically (no sort), the island upgrades on hydration. Documented as `<DataTable mode="progressive">`.

## Acceptance criteria

- Sort, filter, pagination, and row-select work after hydration.
- Server pre-renders the first page so users see data before JS loads.
- Bundle: `@tanstack/react-table` is code-split per page that imports it.
