---
spec: ui/03-alert-dialog
title: Alert Dialog
status: completed
island: true
peer_deps: ["@radix-ui/react-alert-dialog"]
last_reviewed: 2026-05-23
---

# Alert Dialog

## Purpose

Modal confirmation dialog — destructive-action confirmation pattern. Mirrors shadcn `AlertDialog`. Built on `@radix-ui/react-alert-dialog`.

## Island model

`island: true`. Open-state lives on the client; Radix portals the overlay to `document.body`.

The entire dialog tree (`Root`, `Trigger`, `Portal`, `Overlay`, `Content`, `Title`, `Description`, `Action`, `Cancel`) is one island. The trigger must live inside the island so that the click handler is bound.

## Peer dependencies

- `@radix-ui/react-alert-dialog@^1.1`

## Public API

```ts
export const AlertDialog: typeof Primitive.Root
export const AlertDialogTrigger: typeof Primitive.Trigger
export const AlertDialogPortal: typeof Primitive.Portal
export function AlertDialogOverlay(props: Primitive.AlertDialogOverlayProps & { className?: string }): JSX.Element
export function AlertDialogContent(props: Primitive.AlertDialogContentProps & { className?: string }): JSX.Element
export function AlertDialogHeader(props: { className?: string; children?: React.ReactNode }): JSX.Element
export function AlertDialogFooter(props: { className?: string; children?: React.ReactNode }): JSX.Element
export function AlertDialogTitle(props: Primitive.AlertDialogTitleProps): JSX.Element
export function AlertDialogDescription(props: Primitive.AlertDialogDescriptionProps): JSX.Element
export const AlertDialogAction: typeof Primitive.Action
export const AlertDialogCancel: typeof Primitive.Cancel
export const island = true
```

## Patties adjustments

- The portal target defaults to `document.body` on the client; on the server it is a no-op (Radix already handles this).
- `onOpenChange` is in-island only; never crosses the SSR boundary.
- Removes `forwardRef`.

## Acceptance criteria

- Initial SSR HTML contains the trigger only; the dialog content is absent (closed).
- After hydration, clicking the trigger opens the dialog and focus moves to the destructive action (or cancel, per `autoFocus`).
- `Esc` and overlay click are intercepted by Radix and do NOT close the dialog (alert-dialog semantics).
- Inert background tree: `aria-hidden` is applied to siblings when open.
