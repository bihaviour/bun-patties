---
spec: ui/23-drawer
title: Drawer
status: completed
island: true
peer_deps: ["vaul"]
last_reviewed: 2026-05-23
---

# Drawer

## Purpose

Bottom-sheet (mobile-friendly) modal. Mirrors shadcn `Drawer`. Built on `vaul`.

## Island model

`island: true`. Pointer-driven drag and snap-points require client JS.

## Peer dependencies

- `vaul@^1`

## Public API

```ts
export const Drawer: typeof Vaul.Root
export const DrawerTrigger: typeof Vaul.Trigger
export const DrawerPortal: typeof Vaul.Portal
export const DrawerClose: typeof Vaul.Close
export function DrawerOverlay(props: Vaul.OverlayProps & { className?: string }): JSX.Element
export function DrawerContent(props: Vaul.ContentProps & { className?: string }): JSX.Element
export function DrawerHeader(props: React.ComponentProps<"div">): JSX.Element
export function DrawerFooter(props: React.ComponentProps<"div">): JSX.Element
export function DrawerTitle(props: Vaul.TitleProps & { className?: string }): JSX.Element
export function DrawerDescription(props: Vaul.DescriptionProps & { className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- Vaul references `window` in module body; the import is dynamically loaded inside the island file via a top-level import that is dead-code-eliminated for the server build.
- Removes `forwardRef`.

## Acceptance criteria

- SSR renders only the trigger.
- Drag-to-dismiss works on touch and pointer devices after hydration.
- `prefers-reduced-motion` disables the spring animation.
- Server build does not include vaul (verified via bundle-size CI).
