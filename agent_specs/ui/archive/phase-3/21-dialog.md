---
spec: ui/21-dialog
title: Dialog
status: completed
island: true
peer_deps: ["@radix-ui/react-dialog", "lucide-react"]
last_reviewed: 2026-05-23
---

# Dialog

## Purpose

Modal dialog. Mirrors shadcn `Dialog`. Built on `@radix-ui/react-dialog`.

## Island model

`island: true`. Open state and portal mounting need client JS.

## Peer dependencies

- `@radix-ui/react-dialog@^1.1`
- `lucide-react@^0.400` (X close icon)

## Public API

```ts
export const Dialog: typeof Radix.Root
export const DialogTrigger: typeof Radix.Trigger
export const DialogPortal: typeof Radix.Portal
export const DialogClose: typeof Radix.Close
export function DialogOverlay(props: Radix.DialogOverlayProps & { className?: string }): JSX.Element
export function DialogContent(props: Radix.DialogContentProps & { className?: string }): JSX.Element
export function DialogHeader(props: React.ComponentProps<"div">): JSX.Element
export function DialogFooter(props: React.ComponentProps<"div">): JSX.Element
export function DialogTitle(props: Radix.DialogTitleProps & { className?: string }): JSX.Element
export function DialogDescription(props: Radix.DialogDescriptionProps & { className?: string }): JSX.Element

export const island = true
```

## Patties adjustments

- The whole `Dialog` tree is one island root. Triggers outside the island cannot open the dialog.
- `DialogContent` always renders `DialogTitle` (visually hidden if not provided) to satisfy ARIA — Radix logs a warning otherwise.
- Removes `forwardRef`.

## Acceptance criteria

- SSR contains only the trigger; content is absent.
- `Esc`, overlay-click, and X-button all close the dialog (unlike AlertDialog).
- Focus is trapped inside the content and restored to the trigger on close.
- Background scroll is locked while open.
