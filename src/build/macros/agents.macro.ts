import { scanAgents, scanTools, scanJobs, type ScannedModule } from "../../ai/scan.ts"

// Bun macros: invoked at build time via
//   import { AGENTS, TOOLS, JOBS } from "...agents.macro.ts" with { type: "macro" }
// Return values are inlined as JSON literals; runtime never scans the FS.
export async function AGENTS(appDir: string): Promise<ScannedModule[]> {
  return await scanAgents(appDir)
}

export async function TOOLS(appDir: string): Promise<ScannedModule[]> {
  return await scanTools(appDir)
}

export async function JOBS(appDir: string): Promise<ScannedModule[]> {
  return await scanJobs(appDir)
}
