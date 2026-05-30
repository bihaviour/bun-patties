# Web-standards boundary rule

Framework boundaries stay close to web standards.

- Handlers receive a standard `Request` and return a standard `Response`.
- The single framework-added affordance is `PattiesContext` (params, cookies, env, vars, `url`, `json()`, `html()`, `redirect()`). Keep it thin — do not grow it into a Next.js-style request abstraction.
- React SSR uses `renderToReadableStream`, not the legacy Node streaming APIs.
- Adapters under `src/adapters/` (`bun`, `edge`) translate to/from these standards. Platform-specific concerns belong there, not in the core.
