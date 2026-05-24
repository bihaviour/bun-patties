import type { PattiesConfig } from "../config/schema.ts"
import type { BuiltAsset } from "../build/assets.ts"

export interface AdapterContext {
  appDir: string
  outDir: string
  mode: "development" | "production"
  config?: PattiesConfig
  compile?: boolean
}

export interface AdapterBuildInput {
  /** Absolute path to the bundled server entry produced by Bun.build. */
  serverEntryOut: string
  assets: BuiltAsset[]
}

export interface EmittedArtifacts {
  /**
   * Absolute path to the consumable server entry after the adapter's
   * post-processing (e.g. compiled binary for bun, worker.js for edge).
   */
  serverEntry: string
  assets: BuiltAsset[]
  extraFiles?: string[]
}

export interface Adapter {
  name: "edge" | "bun"
  buildTarget: "browser" | "bun"
  emit(input: AdapterBuildInput, ctx: AdapterContext): Promise<EmittedArtifacts>
}
