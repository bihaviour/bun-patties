---
spec: ui/30-input-group
title: Input Group
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Input Group

## Purpose

Input flanked by addons (leading/trailing icons or buttons). Mirrors shadcn `InputGroup`.

## Island model

`island: false`. Layout-only; children follow their own rules.

## Peer dependencies

None.

## Public API

```ts
export function InputGroup(props: React.ComponentProps<"div">): JSX.Element
export function InputGroupAddon(props: { align?: "inline-start" | "inline-end" | "block-start" | "block-end" } & React.ComponentProps<"div">): JSX.Element
export function InputGroupInput(props: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element
export function InputGroupText(props: React.ComponentProps<"span">): JSX.Element
export function InputGroupButton(props: ButtonProps): JSX.Element

export const island = false
```

## Patties adjustments

- Uses logical CSS properties (`inline-start`/`inline-end`) so RTL just works without JS.

## Acceptance criteria

- Addons render flush with the input borders.
- `align="block-start"` works for stacked layouts.
- Bundle audit: zero JS for the group itself.
