---
spec: ui/13-chart
title: Chart
status: draft
island: true
peer_deps: ["recharts"]
last_reviewed: 2026-05-23
---

# Chart

## Purpose

Themed charting wrapper around `recharts`. Mirrors shadcn `Chart`. Provides a config-driven theme + tooltip + legend that align with the Patties token system.

## Island model

`island: true`. Recharts measures container size at runtime and renders SVG via D3 internals.

## Peer dependencies

- `recharts@^2.13`

## Public API

```ts
export type ChartConfig = Record<string, {
  label?: React.ReactNode
  icon?: React.ComponentType
  color?: string
  theme?: { light: string; dark: string }
}>

export function ChartContainer(props: {
  config: ChartConfig
  id?: string
  className?: string
  children: React.ReactNode
}): JSX.Element

export function ChartTooltip(props: React.ComponentProps<typeof Recharts.Tooltip>): JSX.Element
export function ChartTooltipContent(props: ChartTooltipContentProps): JSX.Element
export function ChartLegend(props: React.ComponentProps<typeof Recharts.Legend>): JSX.Element
export function ChartLegendContent(props: ChartLegendContentProps): JSX.Element

export const island = true
```

## Patties adjustments

- `ChartContainer` injects per-chart CSS variables (`--color-<key>`) scoped by id so light/dark themes Just Work.
- The chart's underlying `ResponsiveContainer` is wrapped in a `ClientOnly`-equivalent — SSR renders an empty `<svg>` with the configured aspect ratio to prevent layout shift; recharts hydrates.
- `config` is JSON-serializable and crosses the island boundary; `icon` (a component) must be referenced by registered string key, not passed directly.

## Acceptance criteria

- SSR renders a placeholder `<div>` at the correct aspect ratio; no recharts code runs server-side.
- After hydration, the chart fills the container and tooltip shows tokenized colors.
- Dark mode toggles produce different colors via `theme.light` / `theme.dark`.
- Bundle is code-split: pages without charts don't load recharts.
