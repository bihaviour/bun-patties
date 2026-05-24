import { xxh64 } from "./hash.ts"

export interface BuiltAsset {
  src: string         // absolute source path
  dest: string        // absolute destination path
  publicPath: string  // URL path under /_patties/assets/
  hash: string
}

export async function copyAssets(appDir: string, outDir: string): Promise<BuiltAsset[]> {
  const publicDir = appDir.replace(/\/+$/, "") + "/public"
  const destDir = outDir.replace(/\/+$/, "") + "/assets"
  const glob = new Bun.Glob("**/*")
  const out: BuiltAsset[] = []

  try {
    for await (const rel of glob.scan({ cwd: publicDir, onlyFiles: true })) {
      const src = publicDir + "/" + rel
      const bytes = await Bun.file(src).bytes()
      const hash = xxh64(bytes)
      const dest = destDir + "/" + rel
      await Bun.write(dest, bytes)
      out.push({
        src,
        dest,
        publicPath: "/_patties/assets/" + rel,
        hash,
      })
    }
  } catch (err) {
    const msg = (err as Error)?.message ?? ""
    if (/ENOENT|no such file/i.test(msg)) return []
    throw err
  }

  return out
}
