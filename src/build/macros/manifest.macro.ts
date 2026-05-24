// Bun macro: reads the on-disk client manifest produced by the build pipeline
// and inlines it into the importer as a JSON literal. Invoked from the
// generated server entry as:
//   import { MANIFEST } from "...manifest.macro.ts" with { type: "macro" }
//   const M = await MANIFEST("/abs/path/to/manifest.json")
export async function MANIFEST(path: string) {
  return await Bun.file(path).json()
}
