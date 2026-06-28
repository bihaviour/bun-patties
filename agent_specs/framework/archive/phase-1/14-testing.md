---
spec: framework/14-testing
title: Testing (Fixture-Driven)
status: draft
phase: 1
file: tests/fixtures/
last_reviewed: 2026-05-23
---

# Spec 14 — Testing (Fixture-Driven)

## Purpose

Every framework feature is verified by a real Patties app that exercises it. Fixtures are the source of truth — unit tests support them, they do not replace them.

## Workflow for adding a feature

1. Create `tests/fixtures/<feature-name>/` containing a minimal Patties app.
2. Run it manually with `bun dev` inside the fixture. Confirm the behavior is what you want before you write framework code.
3. Implement the framework code that makes the fixture work.
4. Write an integration test that:
   - Boots the fixture via the framework's `startServer`.
   - Hits it with `fetch`.
   - Asserts on the response.
5. All tests must pass before opening a PR.

## Fixture layout

```
tests/fixtures/counter-island/
  app/
    routes/index.tsx
    islands/counter.tsx
  package.json   # bun-link to the framework
  patties.config.ts
```

## Test runner

- `bun test` runs everything.
- Integration tests live in `tests/integration/*.test.ts` and import fixtures by path.
- No Jest, no Vitest — `bun:test` only.

### Mocks & spies

Use Bun's built-in primitives from `bun:test`:

- `mock(() => value)` for plain function mocks.
- `spyOn(obj, "method")` for instance/method spies.
- `mock.module("module-id", () => ({ ... }))` to stub an entire module (preferred over hand-rolled DI for framework internals).

Never reach for `vi.fn`, `jest.fn`, `sinon`, or `proxyquire`. Test doubles for the `AiContext` (spec [10](../phase-3/10-agents-and-tools.md)) use `mock.module("@anthropic-ai/sdk", ...)` so request-shaped traffic is asserted without hitting the network.

### Snapshot strategy

`Bun.deepEquals(actual, expected)` is preferred over snapshot files for structured assertions — diffs land in the test output, not in a `__snapshots__/` directory that drifts silently.

## What to test

- The fixture's golden-path request returns the expected status and body shape.
- The fixture's HMR behavior in dev (where applicable).
- The fixture's build output exists at the expected path.

## What not to test

- Internal implementation details of `Bun.build` or `react-dom` — trust the dependency.
- Snapshot tests on rendered HTML beyond load-bearing structure (markers, manifest tags).

## Acceptance criteria

- A new framework PR without a fixture is rejected in review.
- `bun test` runs to completion in the CI matrix on every PR.
