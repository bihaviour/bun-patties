import type { RouteEntry } from "../types.ts"

export function assertNoConflicts(entries: RouteEntry[]): void {
  const byPattern = new Map<string, string[]>()
  for (const e of entries) {
    const existing = byPattern.get(e.bunPattern)
    if (existing) {
      existing.push(e.filePath)
    } else {
      byPattern.set(e.bunPattern, [e.filePath])
    }
  }
  for (const [pattern, files] of byPattern) {
    if (files.length > 1) {
      throw new Error(
        `Route conflict at pattern "${pattern}": ${files.join(", ")}`,
      )
    }
  }
}
