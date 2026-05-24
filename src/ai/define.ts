import type { AgentConfig, JobConfig, ToolConfig } from "./types.ts";

export function defineAgent(config: AgentConfig): AgentConfig {
	return config;
}

export function defineTool<TInput, TOutput>(
	config: ToolConfig<TInput, TOutput>,
): ToolConfig<TInput, TOutput> {
	return config;
}

export function defineJob(config: JobConfig): JobConfig {
	return config;
}
