import { z } from "zod"
import { resolve, isAbsolute } from "node:path"
import { PattiesConfigSchema, type PattiesConfig } from "./schema.ts"

const CANDIDATES = ["patties.config.ts", "patties.config.js", "patties.config.mjs"]

export interface LoadedConfig {
  config: PattiesConfig
  path: string | null
}

export async function loadConfig(cwd: string = process.cwd()): Promise<LoadedConfig> {
  const found = await findConfigFile(cwd)
  let raw: unknown = {}
  if (found) {
    const mod = (await import(found)) as { default?: unknown }
    raw = mod.default ?? {}
  }

  let parsed: PattiesConfig
  try {
    parsed = PattiesConfigSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      const lines = err.issues.map(
        (i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`,
      )
      const where = found ?? "<defaults>"
      throw new Error(`patties config invalid (${where}):\n${lines.join("\n")}`)
    }
    throw err
  }

  parsed.appDir = absolutize(parsed.appDir, cwd)
  parsed.outDir = absolutize(parsed.outDir, cwd)

  return { config: parsed, path: found }
}

async function findConfigFile(cwd: string): Promise<string | null> {
  for (const name of CANDIDATES) {
    const p = resolve(cwd, name)
    if (await Bun.file(p).exists()) return p
  }
  return null
}

function absolutize(p: string, cwd: string): string {
  return isAbsolute(p) ? p : resolve(cwd, p)
}
