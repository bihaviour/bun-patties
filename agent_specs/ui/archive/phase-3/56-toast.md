---
spec: ui/56-toast
title: Toast (deprecated; prefer Sonner)
status: completed
island: true
peer_deps: ["@radix-ui/react-toast"]
last_reviewed: 2026-05-23
---

# Toast

## Purpose

Radix-based toast primitives. Mirrors shadcn `Toast`. **Marked deprecated by upstream in favor of [50-sonner](./50-sonner.md);** kept for parity and for users who want first-party Radix instead of `sonner`.

## Island model

`island: true`. Toaster portal + imperative API need JS.

## Peer dependencies

- `@radix-ui/react-toast@^1.2`

## Public API

```ts
export const ToastProvider: typeof Radix.Provider
export const ToastViewport: typeof Radix.Viewport
export const Toast: typeof Radix.Root
export const ToastTitle: typeof Radix.Title
export const ToastDescription: typeof Radix.Description
export const ToastClose: typeof Radix.Close
export const ToastAction: typeof Radix.Action

export function useToast(): {
  toasts: ToastInstance[]
  toast: (opts: ToastOptions) => { id: string; dismiss: () => void; update: (opts: ToastOptions) => void }
  dismiss: (id?: string) => void
}

export const island = true
```

## Patties adjustments

- `useToast` is exported from a single island module that owns a small in-memory store.
- The `ToastProvider`/`ToastViewport` must be mounted once at the root island.

## Acceptance criteria

- `toast({ title, description })` shows the toast and auto-dismisses after timeout.
- Multiple toasts stack in the viewport.
- Keyboard `F8` focuses the toast region (Radix default).
