---
spec: ui/60-typography
title: Typography
status: completed
island: false
peer_deps: []
last_reviewed: 2026-05-23
---

# Typography

## Purpose

Prose primitives — `H1`/`H2`/`H3`/`H4`, `P`, `Blockquote`, `InlineCode`, `Lead`, `Large`, `Small`, `Muted`, `List`. Mirrors shadcn `Typography` (which is itself a set of recipes, not a tightly-bound primitive).

## Island model

`island: false`. Pure presentational.

## Peer dependencies

None.

## Public API

```ts
export function H1(props: React.ComponentProps<"h1">): JSX.Element
export function H2(props: React.ComponentProps<"h2">): JSX.Element
export function H3(props: React.ComponentProps<"h3">): JSX.Element
export function H4(props: React.ComponentProps<"h4">): JSX.Element
export function P(props: React.ComponentProps<"p">): JSX.Element
export function Blockquote(props: React.ComponentProps<"blockquote">): JSX.Element
export function InlineCode(props: React.ComponentProps<"code">): JSX.Element
export function Lead(props: React.ComponentProps<"p">): JSX.Element
export function Large(props: React.ComponentProps<"div">): JSX.Element
export function Small(props: React.ComponentProps<"small">): JSX.Element
export function Muted(props: React.ComponentProps<"p">): JSX.Element
export function List(props: React.ComponentProps<"ul">): JSX.Element

export const island = false
```

## Patties adjustments

- Exports are individual semantic components rather than a single `Typography` wrapper, to encourage correct heading hierarchy.
- A separate `prose` Tailwind class chain is documented for `@tailwindcss/typography`-rendered Markdown content; the primitives above are for non-prose contexts.

## Acceptance criteria

- Each primitive renders the correct HTML element with the expected token classes.
- Heading sizes follow a clear visual scale at every breakpoint.
- Bundle audit: zero JS.
