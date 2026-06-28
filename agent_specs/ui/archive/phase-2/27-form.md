---
spec: ui/27-form
title: Form
status: completed
island: true
peer_deps: ["react-hook-form", "@hookform/resolvers", "zod"]
last_reviewed: 2026-05-23
---

# Form

## Purpose

`react-hook-form` + Zod adapter for the [26-field](./26-field.md) primitives. Mirrors shadcn `Form` (the older RHF-flavored recipe; still ships for parity).

## Island model

`island: true`. RHF needs a live React tree. For SSR-first form usage without RHF, use Field + native `<form action="…">` instead.

## Peer dependencies

- `react-hook-form@^7`
- `@hookform/resolvers@^3`
- `zod@^3`

## Public API

```ts
export const Form: typeof FormProvider
export const FormField: typeof Controller

export function FormItem(props: React.ComponentProps<"div">): JSX.Element
export function FormLabel(props: React.ComponentProps<typeof LabelPrimitive.Root>): JSX.Element
export function FormControl(props: React.ComponentProps<typeof Slot>): JSX.Element
export function FormDescription(props: React.ComponentProps<"p">): JSX.Element
export function FormMessage(props: React.ComponentProps<"p">): JSX.Element
export function useFormField(): { id: string; name: string; formItemId: string; formDescriptionId: string; formMessageId: string; error?: FieldError }

export const island = true
```

## Patties adjustments

- The schema crosses no boundary (it's defined in the island module). Server validation should happen in a Patties route handler that re-uses the same Zod schema imported from a shared file.
- Patties recommends Field+native-form for simple cases; use Form only when client validation is required.

## Acceptance criteria

- A controlled RHF form hydrates with the correct initial values.
- Field/error wiring matches `aria-describedby` and `aria-invalid`.
- Submit handler can call `event.preventDefault()` and a Patties route via `fetch`.
