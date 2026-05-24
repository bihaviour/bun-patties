import { jsonResponse, htmlResponse, redirectResponse } from "./response-helpers.ts"
import { appendCookieHeaders } from "./cookies.ts"

export interface PattiesContext {
  params: Record<string, string>
  cookies: unknown
  env: Record<string, string | undefined>
  aiContext?: unknown
  csrf?: { token(): string; verify(t: string | null): boolean }
  vars: Record<string, unknown>
  url: URL
  json(body: unknown, init?: ResponseInit): Response
  html(body: string | ReadableStream, init?: ResponseInit): Response
  redirect(to: string, status?: 301 | 302 | 303 | 307 | 308): Response
}

export type Handler = (req: Request, ctx: PattiesContext) => Response | Promise<Response>

export type Middleware = (
  req: Request,
  ctx: PattiesContext,
  next: () => Promise<Response>,
) => Promise<Response>

export function defineMiddleware(m: Middleware): Middleware {
  return m
}

export function compose(middlewares: Middleware[], handler: Handler): Handler {
  return (req, ctx) => {
    let lastIdx = -1
    const dispatch = (idx: number): Promise<Response> => {
      if (idx <= lastIdx) {
        return Promise.reject(new Error("next() called multiple times"))
      }
      lastIdx = idx
      const fn = idx < middlewares.length ? middlewares[idx] : null
      if (!fn) return Promise.resolve(handler(req, ctx))
      return Promise.resolve(fn(req, ctx, () => dispatch(idx + 1)))
    }
    return dispatch(0)
  }
}

export function makeContext(req: Request, params: Record<string, string> = {}): PattiesContext {
  let urlCache: URL | null = null
  let cookiesCache: unknown = undefined
  const env = (typeof Bun !== "undefined" ? Bun.env : process.env) as Record<string, string | undefined>

  const ctx: PattiesContext = {
    params,
    get cookies() {
      if (cookiesCache === undefined) {
        const anyReq = req as unknown as { cookies?: unknown }
        if (anyReq.cookies != null) {
          cookiesCache = anyReq.cookies
        } else {
          // Bun's `fetch:` catch-all (404 fallback) doesn't populate req.cookies
          // the way the routes table does. Synthesize one from the Cookie header
          // so middleware can read/set cookies on every path.
          const Ctor = (Bun as unknown as { CookieMap?: new (init?: string) => unknown }).CookieMap
          cookiesCache = Ctor ? new Ctor(req.headers.get("cookie") ?? "") : null
        }
      }
      return cookiesCache
    },
    env,
    vars: {},
    get url() {
      if (!urlCache) urlCache = new URL(req.url)
      return urlCache
    },
    json: jsonResponse,
    html: htmlResponse,
    redirect: redirectResponse,
  }
  return ctx
}

export { appendCookieHeaders }
