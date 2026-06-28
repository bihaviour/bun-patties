---
spec: ui/17-command
title: Command
status: draft
island: true
peer_deps: ["cmdk", "@radix-ui/react-dialog", "lucide-react"]
last_reviewed: 2026-05-23
---

# Command

## Purpose

Command palette / fuzzy menu. Mirrors shadcn `Command`. Built on `cmdk`.

## Island model

`island: true`. Filter state, keyboard navigation, and focus management require client JS.

## Peer dependencies

- `cmdk@^1`
- `@radix-ui/react-dialog@^1.1` (for `CommandDialog` variant)
- `lucide-react@^0.400`

## Public API

```ts
export function Command(props: React.ComponentProps<typeof CommandPrimitive>): JSX.Element
export function CommandDialog(props: { open?: boolean; onOpenChange?: (o: boolean) => void; children?: React.ReactNode }): JSX.Element
export function CommandInput(props: React.ComponentProps<typeof CommandPrimitive.Input>): JSX.Element
export function CommandList(props: React.ComponentProps<typeof CommandPrimitive.List>): JSX.Element
export function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>): JSX.Element
export function CommandGroup(props: React.ComponentProps<typeof CommandPrimitive.Group>): JSX.Element
export function CommandItem(props: React.ComponentProps<typeof CommandPrimitive.Item>): JSX.Element
export function CommandShortcut(props: React.ComponentProps<"span">): JSX.Element
export function CommandSeparator(props: React.ComponentProps<typeof CommandPrimitive.Separator>): JSX.Element

export const island = true
```

## Patties adjustments

- `CommandDialog` wraps the palette in a Radix Dialog so that `Cmd+K` global trigger can mount a modal.
- The `Cmd+K`/`Ctrl+K` global hotkey is **not** registered automatically; userland binds it in an island.
- Removes `forwardRef`.

## Acceptance criteria

- Typing filters items via `cmdk`.
- `↑/↓/Enter/Esc` navigate and select.
- `CommandDialog` traps focus while open and restores on close.
- Items can declare `value` distinct from their visible label for stable filtering.
