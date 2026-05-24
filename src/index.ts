export { createServer, startServer } from "./server/index.ts"
export type { ServerOptions, ServerHandle } from "./server/index.ts"

export { createRouter } from "./router/index.ts"
export type { RouterOptions, CompiledRouter, Plugin } from "./router/index.ts"

export { createRenderer } from "./render/index.tsx"
export type { Renderer, RenderOptions, ClientManifest } from "./render/index.tsx"

export { defineMiddleware, compose, makeContext } from "./middleware/index.ts"
export type { Middleware, Handler, PattiesContext } from "./middleware/index.ts"

export { scanRoutes } from "./router/filesystem.ts"
export type { RouteEntry, Segment, BunRoutes, HTTPMethod } from "./types.ts"

export { defineConfig } from "./config/define.ts"
export { loadConfig } from "./config/load.ts"
export { PattiesConfigSchema } from "./config/schema.ts"
export type { PattiesConfig, PattiesConfigInput } from "./config/schema.ts"
export { MissingEnv, getEnv, validateRequiredEnv } from "./config/env.ts"
export { loadSecrets } from "./config/secrets.ts"

export { build } from "./build/index.ts"
export type {
  BuildOptions,
  BuildResult,
  BuiltAsset,
  ClientManifest as BuildClientManifest,
} from "./build/index.ts"

export type {
  AiContext,
  AgentConfig,
  ToolConfig,
  JobConfig,
  AgentRunResult,
  RegisteredAgent,
  RegisteredTool,
  RegisteredJob,
  AnthropicLike,
} from "./ai/types.ts"
export type { CreateAiContextOptions } from "./ai/context.ts"

export { generateAgentsMd } from "./agents-md/generate.ts"
