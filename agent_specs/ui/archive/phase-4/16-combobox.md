---
spec: ui/16-combobox
title: Combobox
status: draft
island: true
peer_deps: ["@radix-ui/react-popover", "cmdk", "lucide-react"]
last_reviewed: 2026-05-23
---

# Combobox

## Purpose

Searchable single-select — Popover + Command + List. Mirrors shadcn `Combobox` (composed pattern, not a single primitive).

## Island model

`island: true`. Filter, popover open-state, and active descendant tracking all need client JS.

## Peer dependencies

- `@radix-ui/react-popover@^1.1`
- `cmdk@^1`
- `lucide-react@^0.400`

## Public API

The Combobox is delivered as a **composed example** in `app/components/ui/combobox.tsx`, not as a tightly-wrapped primitive. Required pieces are imported from [17-command](./17-command.md) and [39-popover](./39-popover.md):

```ts
export function Combobox<T>(props: {
  options: Array<{ value: string; label: string }>
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
}): JSX.Element

export const island = true
```

## Patties adjustments

- The whole Combobox is one island root — Popover + Command + List share state without crossing the SSR boundary.
- `options` must be JSON-serializable (strings only).
- For very large lists (>500 items), the spec recommends switching to a virtualized variant (out of scope here).

## Acceptance criteria

- Typing in the search filters options (cmdk substring match).
- `Enter` selects the active option; `Esc` closes the popover.
- Selected option shows a check icon and the trigger label updates.
- Closes on outside click and restores focus to the trigger.
