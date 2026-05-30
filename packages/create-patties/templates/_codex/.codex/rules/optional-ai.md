# Optional AI dependency rule

The Anthropic SDK is an **optional** peer dependency. Apps that do
not use the `app/agents/`, `app/tools/`, or `app/jobs/` directories
must still install and run without `@anthropic-ai/sdk` present.

- Never `import "@anthropic-ai/sdk"` at the top level of a route or
  middleware file. Wrap it in a dynamic `import()` inside the function
  that needs it, or accept an `AnthropicLike` instance from
  `PattiesContext`.
- Do not move `@anthropic-ai/sdk` into `dependencies` unless your app
  genuinely requires it at boot. Even then, prefer keeping it as a
  peer + `bun add @anthropic-ai/sdk` step.
- The auto-generated `AGENTS.md` references AI types, but does not
  require a live SDK at import time.
