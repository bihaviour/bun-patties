import { collect } from "./collect.ts"
import { render } from "./render.ts"

export interface ResolvedConfigLike {
  appDir?: string
  env?: { required?: string[]; optional?: string[] }
  plugins?: Array<{ name?: string; onAgentsMdGenerate?: (doc: string) => string | Promise<string> }>
}

// Public entry point for spec 11. Caller writes the returned string to disk.
export async function generateAgentsMd(appDir: string, config: ResolvedConfigLike = {}): Promise<string> {
  const envVars: Array<{ name: string; required: boolean; description?: string }> = []
  for (const r of config.env?.required ?? []) envVars.push({ name: r, required: true })
  for (const o of config.env?.optional ?? []) envVars.push({ name: o, required: false })

  const data = await collect(appDir, envVars)
  let md = render(data)

  // Plugin hook (real plugin loading lands in phase 4; today this is a no-op
  // when config.plugins is empty).
  for (const p of config.plugins ?? []) {
    if (typeof p?.onAgentsMdGenerate === "function") {
      md = await p.onAgentsMdGenerate(md)
    }
  }
  return md
}
