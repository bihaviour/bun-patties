import { scanRoutes } from "../../router/filesystem.ts"

// Bun macro: invoked at build time via
//   import { ROUTES } from "...routes.macro.ts" with { type: "macro" }
//   const TABLE = await ROUTES("/abs/app/dir")
// The macro return value is inlined as a JSON literal — neither this file nor
// `scanRoutes` ends up in the production server bundle. See spec 04.
export async function ROUTES(appDir: string) {
  return await scanRoutes(appDir)
}
