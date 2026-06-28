---
spec: ui/18-context-menu
title: Context Menu
status: completed
island: true
peer_deps: ["@radix-ui/react-context-menu", "lucide-react"]
last_reviewed: 2026-05-23
---

# Context Menu

## Purpose

Right-click contextual menu. Mirrors shadcn `ContextMenu`. Built on `@radix-ui/react-context-menu`.

## Island model

`island: true`. Open-state and pointer/keyboard interactions require client JS. SSR renders only the trigger area.

## Peer dependencies

- `@radix-ui/react-context-menu@^2.2`
- `lucide-react@^0.400` (Check, ChevronRight, Circle)

## Public API

```ts
export const ContextMenu: typeof Radix.Root
export const ContextMenuTrigger: typeof Radix.Trigger
export const ContextMenuGroup: typeof Radix.Group
export const ContextMenuPortal: typeof Radix.Portal
export const ContextMenuSub: typeof Radix.Sub
export const ContextMenuRadioGroup: typeof Radix.RadioGroup
export function ContextMenuSubTrigger(props: Radix.ContextMenuSubTriggerProps & { className?: string; inset?: boolean }): JSX.Element
export function ContextMenuSubContent(props: Radix.ContextMenuSubContentProps & { className?: string }): JSX.Element
export function ContextMenuContent(props: Radix.ContextMenuContentProps & { className?: string }): JSX.Element
export function ContextMenuItem(props: Radix.ContextMenuItemProps & { className?: string; inset?: boolean }): JSX.Element
export function ContextMenuCheckboxItem(props: Radix.ContextMenuCheckboxItemProps & { className?: string }): JSX.Element
export function ContextMenuRadioItem(props: Radix.ContextMenuRadioItemProps & { className?: string }): JSX.Element
export function ContextMenuLabel(props: Radix.ContextMenuLabelProps & { className?: string; inset?: boolean }): JSX.Element
export function ContextMenuSeparator(props: Radix.ContextMenuSeparatorProps & { className?: string }): JSX.Element
export function ContextMenuShortcut(props: React.ComponentProps<"span">): JSX.Element

export const island = true
```

## Patties adjustments

- Removes `forwardRef` everywhere.
- The portal lives outside the island in the DOM (Radix), but is logically owned by the island root.

## Acceptance criteria

- Right-click on the trigger area opens the menu at the cursor.
- `Esc` closes; outside-click closes.
- Submenus open on hover with the right keyboard semantics.
- Radio and checkbox items reflect controlled state.
