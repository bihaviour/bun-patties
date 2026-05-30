# Web-standards boundary rule

The framework stays close to web standards at handler boundaries. Do
not paper over them with a custom request abstraction.

- **Handler signature:** `(req: Request, ctx: PattiesContext) => Response | Promise<Response>`.
  `req` is a standard web `Request`; the handler returns a standard web
  `Response`. Streaming responses use `ReadableStream`.
- **`PattiesContext` is the only framework-added affordance.** It
  exposes `params`, `cookies`, `env`, `vars`, `url`, and the
  short-circuit helpers `ctx.json(data, init?)`, `ctx.html(body, init?)`,
  `ctx.redirect(to, status?)`. Keep it thin — don't expect a
  Next-style `request.cookies.set(...)` API.
- **No Hono / Express / Fastify types.** If you find yourself reaching
  for `MiddlewareHandler` from Hono, write the standard
  `Middleware = (req, ctx, next) => Promise<Response>` instead.
- **React SSR uses `renderToReadableStream`** (the streaming web API).
  Do not use `renderToString` or `renderToPipeableStream`.
- **Client hydration uses `hydrateRoot`** (React 19). Do not use
  `ReactDOM.render`.

If a deployment target needs platform-specific wiring (Vercel edge
context, Cloudflare bindings, etc.), the framework's adapters under
`patties/adapters` translate to/from these web-standard handlers — that
belongs in the adapter, not in your routes.
