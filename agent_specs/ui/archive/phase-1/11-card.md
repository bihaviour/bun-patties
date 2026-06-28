---
spec: ui/11-card
title: Card
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Card

## Purpose

Container with header, content, footer slots. Mirrors shadcn `Card`.

## Island model

`island: false`. Layout-only. Interactive children (Button, etc.) follow their own rules.

## Peer dependencies

None.

## Public API

```ts
export function Card(props: React.ComponentProps<"div">): JSX.Element
export function CardHeader(props: React.ComponentProps<"div">): JSX.Element
export function CardTitle(props: React.ComponentProps<"div">): JSX.Element
export function CardDescription(props: React.ComponentProps<"div">): JSX.Element
export function CardAction(props: React.ComponentProps<"div">): JSX.Element
export function CardContent(props: React.ComponentProps<"div">): JSX.Element
export function CardFooter(props: React.ComponentProps<"div">): JSX.Element

export const island = false
```

## Patties adjustments

- `CardTitle` defaults to a `<div>` with `role="heading"` only if no semantic heading is provided as `asChild`. The recommended path is `<CardTitle asChild><h2>…</h2></CardTitle>`.

## Acceptance criteria

- All seven slots snapshot correctly.
- Bundle audit: zero JS.
