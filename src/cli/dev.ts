import { resolve } from "node:path"
import { existsSync } from "node:fs"
import { createDevServer } from "../dev/watcher.ts"
import { startServer } from "../server/index.ts"
import { loadConfig } from "../config/load.ts"
import { loadSecrets } from "../config/secrets.ts"
import { validateRequiredEnv, MissingEnv } from "../config/env.ts"
import { generateAgentsMd } from "../agents-md/generate.ts"

export interface DevArgs {
  cold: boolean
  port: number | null
  host: string | null
  appDir: string | null
}

const REEXEC_FLAG = "PATTIES_DEV_HOT"

export async function runDev(argv: string[]): Promise<number> {
  const args = parseArgs(argv)

  if (process.env[REEXEC_FLAG] !== "1") {
    return reexecUnderBun(args)
  }

  return bootstrap(args)
}

function parseArgs(argv: string[]): DevArgs {
  const out: DevArgs = {
    cold: false,
    port: null,
    host: null,
    appDir: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === "--cold") out.cold = true
    else if (a === "--port") out.port = Number(argv[++i])
    else if (a === "--host") out.host = String(argv[++i])
    else if (a === "--app") out.appDir = resolve(process.cwd(), String(argv[++i]))
    else if (a.startsWith("--port=")) out.port = Number(a.slice(7))
    else if (a.startsWith("--host=")) out.host = a.slice(7)
    else if (a.startsWith("--app=")) out.appDir = resolve(process.cwd(), a.slice(6))
  }
  return out
}

interface ResolvedDev {
  port: number
  host: string
  appDir: string
  unix: string | undefined
  reusePort: boolean | undefined
  requiredEnv: string[]
  secrets: string[]
}

async function resolveDev(args: DevArgs): Promise<ResolvedDev> {
  const { config } = await loadConfig(process.cwd())
  const envPort = process.env.PORT ? Number(process.env.PORT) : undefined
  const envHost = process.env.HOST
  return {
    port: args.port ?? envPort ?? config.server.port,
    host: args.host ?? envHost ?? config.server.hostname,
    appDir: args.appDir ?? config.appDir,
    unix: config.server.unix,
    reusePort: config.server.reusePort,
    requiredEnv: config.env.required,
    secrets: config.secrets,
  }
}

async function reexecUnderBun(args: DevArgs): Promise<number> {
  const entry = process.argv[1] ?? ""
  const mode = args.cold ? "--watch" : "--hot"
  const passthrough = ["dev"]
  if (args.cold) passthrough.push("--cold")
  if (args.port !== null) passthrough.push("--port", String(args.port))
  if (args.host !== null) passthrough.push("--host", args.host)
  if (args.appDir !== null) passthrough.push("--app", args.appDir)
  const proc = Bun.spawn(["bun", mode, entry, ...passthrough], {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env, [REEXEC_FLAG]: "1" },
  })
  const code = await proc.exited
  return code ?? 0
}

async function bootstrap(args: DevArgs): Promise<number> {
  const { config } = await loadConfig(process.cwd())
  const resolved = await resolveDev(args)

  await loadSecrets(config)
  try {
    validateRequiredEnv(resolved.requiredEnv)
  } catch (err) {
    if (err instanceof MissingEnv) {
      console.error(`[patties] ${err.message}`)
      return 1
    }
    throw err
  }

  const devServer = createDevServer({ appDir: resolved.appDir })

  // Initial AGENTS.md generation — fire-and-forget; never crashes dev.
  generateAgentsMd(resolved.appDir, {
    appDir: resolved.appDir,
    env: { required: config.env.required, optional: config.env.public },
  })
    .then((md) => Bun.write(process.cwd() + "/AGENTS.md", md))
    .catch((err) => console.warn(`[patties] AGENTS.md generation failed:`, (err as Error)?.message ?? err))

  const entry = findUserEntry(resolved.appDir)
  if (entry) {
    const mod = (await import(entry)) as { default?: unknown }
    const start = mod.default as
      | ((opts: { devServer: typeof devServer; port: number; host: string; appDir: string }) => void | Promise<void>)
      | undefined
    if (typeof start === "function") {
      await start({ devServer, port: resolved.port, host: resolved.host, appDir: resolved.appDir })
      return 0
    }
    console.warn(`[patties] ${entry} has no default export; starting a stub dev server.`)
  } else {
    console.warn(`[patties] no app entry found at ${resolved.appDir}/server.ts — starting a stub dev server.`)
  }

  startServer({
    port: resolved.port,
    hostname: resolved.host,
    unix: resolved.unix,
    reusePort: resolved.reusePort,
    dev: true,
    devServer,
    routes: {
      "/": (() => new Response("patties dev: no app entry. Create app/server.ts.", { status: 200 })) as never,
    },
    fallback: () => new Response("not found", { status: 404 }),
  })
  return await new Promise<number>(() => {})
}

function findUserEntry(appDir: string): string | null {
  const candidates = [`${appDir}/server.ts`, `${appDir}/server.tsx`, `${appDir}/index.ts`]
  for (const c of candidates) if (existsSync(c)) return c
  return null
}
