import type { RouteEntry } from "../types.ts"

export interface ServerEntryInput {
  appDir: string
  entries: RouteEntry[]
  hasUserMiddleware: boolean
  frameworkRoot: string         // absolute path to the framework src/ root
  routesMacroPath: string       // absolute path to routes.macro.ts
  envMacroPath: string          // absolute path to env.macro.ts
  manifestMacroPath: string     // absolute path to manifest.macro.ts
  agentsHashMacroPath: string   // absolute path to agents-hash.macro.ts
  manifestPath: string          // absolute path to the on-disk manifest.json
  target: "bun" | "edge"
  port?: number
}

// Generate the source for the synthetic server entry written into outDir/.gen/.
// Build-time data (route table, public env, client manifest, AGENTS.md hash) is
// pulled in via Bun's `with { type: "macro" }` import attribute so the
// production bundle never performs a filesystem scan — the guarantee is
// compiler-enforced, not author-disciplined. See spec 04 §"Macro policy".
export function generateServerEntry(input: ServerEntryInput): string {
  const {
    appDir,
    entries,
    hasUserMiddleware,
    frameworkRoot,
    routesMacroPath,
    envMacroPath,
    manifestMacroPath,
    agentsHashMacroPath,
    manifestPath,
    target,
    port,
  } = input

  const fwImport = (sub: string) => JSON.stringify(`${frameworkRoot}/${sub}`)

  // Workaround: Bun.build can fail to resolve a `.tsx` import when a sibling
  // `.ts` import with a shared path prefix is encountered first. Emit the
  // import statements with `.tsx` files first; ROUTE_TABLE keeps the canonical
  // routing order separately.
  const importOrder = entries
    .map((e, idx) => ({ e, idx }))
    .sort((a, b) => {
      const ax = a.e.filePath.endsWith(".tsx") ? 0 : 1
      const bx = b.e.filePath.endsWith(".tsx") ? 0 : 1
      return ax - bx
    })
  const routeImports = importOrder
    .map(({ e, idx }) => `import * as R${idx} from ${JSON.stringify(e.filePath)}`)
    .join("\n")

  const moduleMapEntries = entries
    .map((e, idx) => `  [${JSON.stringify(e.filePath)}]: R${idx}`)
    .join(",\n")

  const middlewareImport = hasUserMiddleware
    ? `import userMiddleware from ${JSON.stringify(appDir + "/middleware.ts")}`
    : `const userMiddleware = undefined`

  const appDirLiteral = JSON.stringify(appDir)
  const manifestPathLiteral = JSON.stringify(manifestPath)

  const bootForBun = `
const server = startServer({
  port: ${port ?? 3000},
  routes: router.routes,
  fallback: router.fallback,
})
export { server }
`.trim()

  const bootForEdge = `
const __compiled = compilePatterns(router.routes)
export default {
  async fetch(req, env, execCtx) {
    const hit = await dispatch(router.routes, req, { env, execCtx }, __compiled)
    if (hit) return hit
    return router.fallback(req)
  }
}
`.trim()

  const boot = target === "edge" ? bootForEdge : bootForBun

  return `${routeImports}
${middlewareImport}
import { ROUTES } from ${JSON.stringify(routesMacroPath)} with { type: "macro" }
import { PUBLIC_ENV } from ${JSON.stringify(envMacroPath)} with { type: "macro" }
import { MANIFEST } from ${JSON.stringify(manifestMacroPath)} with { type: "macro" }
import { AGENTS_HASH } from ${JSON.stringify(agentsHashMacroPath)} with { type: "macro" }
import { createCompiledRouter } from ${fwImport("router/index.ts")}
import { createRenderer } from ${fwImport("render/index.tsx")}
import { startServer } from ${fwImport("server/index.ts")}
import { compilePatterns, dispatch } from ${fwImport("router/match.ts")}

const ROUTE_TABLE = await ROUTES(${appDirLiteral})
const PUBLIC_ENV_VALUES = PUBLIC_ENV()
const MANIFEST_DATA = await MANIFEST(${manifestPathLiteral})
const AGENTS_MD_HASH = await AGENTS_HASH(${appDirLiteral})
void PUBLIC_ENV_VALUES
void AGENTS_MD_HASH
void ${appDirLiteral}
const MODULES = {
${moduleMapEntries}
}

const renderer = createRenderer({ manifest: MANIFEST_DATA, modules: MODULES, dev: false })
const router = await createCompiledRouter({
  renderer,
  middleware: userMiddleware,
  entries: ROUTE_TABLE,
  modules: MODULES,
})

${boot}
`
}
