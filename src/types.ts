import type { Handler, Middleware, PattiesContext } from "./middleware/index.ts"

export type { Handler, Middleware, PattiesContext }

export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"

export const HTTP_METHODS: HTTPMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
]

export interface Segment {
  raw: string
  kind: "static" | "param" | "catchall"
  name?: string
}

export interface RouteEntry {
  filePath: string
  bunPattern: string
  kind: "page" | "api"
  segments: Segment[]
}

// Bun.serve({ routes }) accepts handlers, method-keyed objects, or Response.
// We use plain functions; Bun adapts them as Request -> Response handlers.
export type BunRouteValue =
  | Response
  | ((req: Request & { params: Record<string, string> }) => Response | Promise<Response>)
  | Partial<Record<HTTPMethod, (req: Request & { params: Record<string, string> }) => Response | Promise<Response>>>

export type BunRoutes = Record<string, BunRouteValue>
