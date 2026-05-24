import { loadConfig } from "../../config/load.ts"

// Build-time macro: returns the literal record of public env values that will
// be inlined into the server bundle. Source: `config.env.public` names plus
// `PREFIX_*` glob entries matched against the build host's `Bun.env`. Absent
// names become the empty string per spec 08.
export async function PUBLIC_ENV(): Promise<Record<string, string>> {
  const { config } = await loadConfig()
  const env = (typeof Bun !== "undefined" ? Bun.env : process.env) as Record<string, string | undefined>
  const out: Record<string, string> = {}
  for (const entry of config.env.public) {
    if (entry.endsWith("*")) {
      const prefix = entry.slice(0, -1)
      for (const k of Object.keys(env)) {
        if (k.startsWith(prefix)) out[k] = env[k] ?? ""
      }
    } else {
      out[entry] = env[entry] ?? ""
    }
  }
  return out
}
