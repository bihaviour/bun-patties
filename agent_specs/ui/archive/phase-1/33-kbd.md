---
spec: ui/33-kbd
title: Kbd
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Kbd

## Purpose

Inline keyboard-shortcut badge — e.g. `⌘ K`. Mirrors shadcn `Kbd`.

## Island model

`island: false`. Pure presentational.

## Peer dependencies

None.

## Public API

```ts
export function Kbd(props: React.ComponentProps<"kbd">): JSX.Element
export function KbdGroup(props: React.ComponentProps<"span">): JSX.Element

export const island = false
```

## Patties adjustments

- Renders as a `<kbd>` element (not a `<span>`) for screen-reader semantics.
- `KbdGroup` is a thin `<span>` with `inline-flex` to space multiple `<kbd>`.

## Acceptance criteria

- Renders `<kbd>` with platform-specific keys (mod = ⌘ on macOS, Ctrl elsewhere). Detection runs in a small companion island only when needed; the default SSR is the literal label passed in.
- Bundle audit: zero JS by default.
