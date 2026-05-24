# Optional AI dependency rule

`@anthropic-ai/sdk` is declared as an **optional** peer dependency. Users who do not use AI features must be able to install and run patties without it.

- Code under `src/ai/` must not import `@anthropic-ai/sdk` at the top level of any module that runs for non-AI users. Use dynamic `import()` inside the functions that need it, or accept an `AnthropicLike` instance via dependency injection (see `src/ai/types.ts`).
- Do not move `@anthropic-ai/sdk` into `dependencies` or `peerDependencies` without the `optional: true` flag.
- The `agents-md` and `plugin` subsystems are allowed to reference AI types, but must not require a live SDK at import time.
