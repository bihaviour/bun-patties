---
spec: ui/26-field
title: Field
status: completed
island: true
peer_deps: ["@radix-ui/react-label"]
last_reviewed: 2026-05-23
---

# Field

## Purpose

Form-field wrapper combining label + control + description + error. Mirrors shadcn `Field` (the modern replacement for `Form`).

## Island model

`island: true`. Validation state and `aria-invalid` flip dynamically on user input.

The Field itself owns no logic — it composes a Label, the control, and a message slot — but because the message visibility depends on validation, it lives in the same island as the control.

## Peer dependencies

- `@radix-ui/react-label@^2.1`

## Public API

```ts
export function Field(props: React.ComponentProps<"div"> & { orientation?: "vertical" | "horizontal" }): JSX.Element
export function FieldLabel(props: React.ComponentProps<typeof LabelPrimitive.Root>): JSX.Element
export function FieldDescription(props: React.ComponentProps<"p">): JSX.Element
export function FieldError(props: React.ComponentProps<"p"> & { errors?: string[] }): JSX.Element
export function FieldGroup(props: React.ComponentProps<"div">): JSX.Element
export function FieldSet(props: React.ComponentProps<"fieldset">): JSX.Element
export function FieldLegend(props: React.ComponentProps<"legend">): JSX.Element

export const island = true
```

## Patties adjustments

- `FieldError` accepts a `string[]` so server-rendered validation can hydrate the same DOM.
- IDs are auto-generated via `React.useId` and wired across Label/control/description/error.

## Acceptance criteria

- Server forms with pre-filled `errors` render correctly without JS.
- Client validation updates `aria-invalid` and `aria-describedby` after hydration.
- Horizontal orientation lays out label + control on one row at `md+`.
