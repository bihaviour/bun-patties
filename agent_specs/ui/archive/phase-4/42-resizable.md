---
spec: ui/42-resizable
title: Resizable
status: draft
island: true
peer_deps: ["react-resizable-panels"]
last_reviewed: 2026-05-23
---

# Resizable

## Purpose

Drag-to-resize panel splitter. Mirrors shadcn `Resizable`. Built on `react-resizable-panels`.

## Island model

`island: true`. Pointer drag and persisted sizes need client JS.

## Peer dependencies

- `react-resizable-panels@^2`

## Public API

```ts
export const ResizablePanelGroup: typeof PanelGroup
export const ResizablePanel: typeof Panel
export function ResizableHandle(props: { withHandle?: boolean; className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- `autoSaveId` persists to `localStorage`; SSR renders the configured `defaultSize` so no layout shift on hydration.

## Acceptance criteria

- SSR renders panels at their `defaultSize`.
- Drag adjusts sizes; `autoSaveId` round-trips across reloads.
- Keyboard handle accepts arrow keys to nudge sizes.
