export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8")
  }
  return new Response(JSON.stringify(body), { ...init, headers })
}

export function htmlResponse(body: string | ReadableStream, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "text/html; charset=utf-8")
  }
  return new Response(body, { ...init, headers })
}

export function redirectResponse(to: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
  return new Response(null, { status, headers: { Location: to } })
}
