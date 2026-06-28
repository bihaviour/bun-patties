---
spec: ui/46-sheet
title: Sheet
status: completed
island: true
peer_deps: ["@radix-ui/react-dialog", "lucide-react"]
last_reviewed: 2026-05-23
---

# Sheet

## Purpose

Side-anchored dialog (left/right/top/bottom). Mirrors shadcn `Sheet`. Built on `@radix-ui/react-dialog` with a sliding-content variant.

## Island model

`island: true`. Open state, focus trap, and portal — same as Dialog.

## Peer dependencies

- `@radix-ui/react-dialog@^1.1`
- `lucide-react@^0.400`

## Public API

Same shape as [21-dialog](./21-dialog.md), plus a `side` prop on `SheetContent`:

```ts
export function SheetContent(props: Radix.DialogContentProps & { side?: "top" | "right" | "bottom" | "left"; className?: string }): JSX.Element
export const island = true
```

The remaining exports — `Sheet`, `SheetTrigger`, `SheetPortal`, `SheetClose`, `SheetOverlay`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` — mirror Dialog.

## Patties adjustments

- Side-specific slide animations use Tailwind `data-[state=open]:` selectors so transitions work without JS.
- Removes `forwardRef`.

## Acceptance criteria

- `side="right"` slides in from the right.
- Same focus/keyboard semantics as Dialog.
- Background scroll lock while open.
