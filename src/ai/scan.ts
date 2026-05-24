const TEST_FILE_RE = /\.test\.tsx?$/

export interface ScannedModule {
  name: string
  filePath: string
}

async function scanDir(appDir: string, sub: "agents" | "tools" | "jobs"): Promise<ScannedModule[]> {
  const dir = appDir.replace(/\/+$/, "") + "/" + sub
  const glob = new Bun.Glob("**/*.ts")
  const out: ScannedModule[] = []
  try {
    for await (const rel of glob.scan({ cwd: dir, onlyFiles: true })) {
      const base = rel.split("/").pop()!
      if (base.startsWith("_")) continue
      if (TEST_FILE_RE.test(base)) continue
      const name = base.replace(/\.ts$/, "")
      out.push({ name, filePath: dir + "/" + rel })
    }
  } catch (err) {
    const msg = (err as Error)?.message ?? ""
    if (/ENOENT|no such file/i.test(msg)) return []
    throw err
  }
  out.sort((a, b) => a.filePath.localeCompare(b.filePath))
  return out
}

export function scanAgents(appDir: string): Promise<ScannedModule[]> {
  return scanDir(appDir, "agents")
}

export function scanTools(appDir: string): Promise<ScannedModule[]> {
  return scanDir(appDir, "tools")
}

export function scanJobs(appDir: string): Promise<ScannedModule[]> {
  return scanDir(appDir, "jobs")
}
