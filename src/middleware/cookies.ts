// Append Set-Cookie headers from a mutated Bun.CookieMap onto a Response.
// Bun.CookieMap exposes toSetCookieHeaders() (per the bun-cookies RFC).
// We probe at runtime and fall back to iterating if the shape differs.
export function appendCookieHeaders(res: Response, cookies: unknown): Response {
  if (!cookies || typeof cookies !== "object") return res

  const headerValues: string[] = []
  const anyCookies = cookies as {
    toSetCookieHeaders?: () => string[]
    [Symbol.iterator]?: () => Iterator<[string, unknown]>
  }

  if (typeof anyCookies.toSetCookieHeaders === "function") {
    headerValues.push(...anyCookies.toSetCookieHeaders())
  }

  if (headerValues.length === 0) return res

  const headers = new Headers(res.headers)
  for (const v of headerValues) headers.append("Set-Cookie", v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}
