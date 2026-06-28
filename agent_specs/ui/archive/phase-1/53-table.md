---
spec: ui/53-table
title: Table
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Table

## Purpose

Styled HTML `<table>` primitives. Mirrors shadcn `Table`.

## Island model

`island: false`. Pure presentational.

## Peer dependencies

None.

## Public API

```ts
export function Table(props: React.ComponentProps<"table">): JSX.Element
export function TableHeader(props: React.ComponentProps<"thead">): JSX.Element
export function TableBody(props: React.ComponentProps<"tbody">): JSX.Element
export function TableFooter(props: React.ComponentProps<"tfoot">): JSX.Element
export function TableRow(props: React.ComponentProps<"tr">): JSX.Element
export function TableHead(props: React.ComponentProps<"th">): JSX.Element
export function TableCell(props: React.ComponentProps<"td">): JSX.Element
export function TableCaption(props: React.ComponentProps<"caption">): JSX.Element

export const island = false
```

## Patties adjustments

- Wraps the `<table>` in an `overflow-x-auto` container so wide tables don't break layout.
- No JS-driven features here — those live in [19-data-table](./19-data-table.md).

## Acceptance criteria

- Snapshot of a typical table tree.
- Bundle audit: zero JS.
