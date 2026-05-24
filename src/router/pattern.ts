import type { Segment } from "../types.ts"

export interface ParsedFile {
  bunPattern: string
  segments: Segment[]
  kind: "page" | "api"
}

const CATCHALL_RE = /^\[\.\.\.([^\]]+)\]$/
const PARAM_RE = /^\[([^\]]+)\]$/

// relPath is path under app/routes/, e.g. "index.tsx", "hotels/[city].tsx",
// "api/revenue.ts", "files/[...rest].tsx".
export function parseRouteFile(relPath: string): ParsedFile {
  const isApi = relPath === "api" || relPath.startsWith("api/")
  const ext = relPath.endsWith(".tsx") ? ".tsx" : relPath.endsWith(".ts") ? ".ts" : ""
  if (!ext) throw new Error(`Unsupported route extension: ${relPath}`)

  if (isApi && ext === ".tsx") {
    throw new Error(`API route must be .ts, not .tsx: ${relPath}`)
  }
  if (!isApi && ext === ".ts") {
    throw new Error(
      `Non-API route must be .tsx (pages) - got .ts: ${relPath}. ` +
        `Move it under app/routes/api/ for an API route.`,
    )
  }

  const noExt = relPath.slice(0, -ext.length)
  const parts = noExt.split("/")
  const segments: Segment[] = []

  for (const part of parts) {
    if (part === "" || part === "index") continue

    const catchall = part.match(CATCHALL_RE)
    if (catchall) {
      segments.push({ raw: part, kind: "catchall", name: catchall[1] })
      continue
    }
    const param = part.match(PARAM_RE)
    if (param) {
      segments.push({ raw: part, kind: "param", name: param[1] })
      continue
    }
    segments.push({ raw: part, kind: "static" })
  }

  const pieces = segments.map((s) => {
    if (s.kind === "static") return s.raw
    if (s.kind === "param") return `:${s.name}`
    return "*"
  })
  let bunPattern = "/" + pieces.join("/")
  bunPattern = bunPattern.replace(/\/+/g, "/")
  if (bunPattern.length > 1 && bunPattern.endsWith("/")) {
    bunPattern = bunPattern.slice(0, -1)
  }

  return { bunPattern, segments, kind: isApi ? "api" : "page" }
}

// Sort so that more-specific patterns come first:
//  - more static segments outrank fewer
//  - non-catchall outranks catchall
//  - shorter patterns outrank longer (when static count is equal)
//  - lexicographic tie-break for determinism
export function compareRoutes(
  a: { segments: Segment[]; bunPattern: string },
  b: { segments: Segment[]; bunPattern: string },
): number {
  const aStatic = a.segments.filter((s) => s.kind === "static").length
  const bStatic = b.segments.filter((s) => s.kind === "static").length
  if (aStatic !== bStatic) return bStatic - aStatic

  const aCatch = a.segments.some((s) => s.kind === "catchall") ? 1 : 0
  const bCatch = b.segments.some((s) => s.kind === "catchall") ? 1 : 0
  if (aCatch !== bCatch) return aCatch - bCatch

  if (a.segments.length !== b.segments.length) return a.segments.length - b.segments.length

  return a.bunPattern.localeCompare(b.bunPattern)
}
