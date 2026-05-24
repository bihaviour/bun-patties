import { AgentNotFound, ToolNotFound } from "./errors.ts";
import { runAgent } from "./run.ts";
import type {
	AgentConfig,
	JobConfig,
	RegisteredAgent,
	RegisteredJob,
	RegisteredTool,
	ToolConfig,
} from "./types.ts";

const agents = new Map<string, RegisteredAgent>();
const tools = new Map<string, RegisteredTool>();
const jobs = new Map<string, RegisteredJob>();

export function registerAgent(config: AgentConfig, filePath?: string): void {
	if (agents.has(config.name)) {
		const existing = agents.get(config.name);
		throw new Error(
			`Duplicate agent name "${config.name}": already registered from ${existing?.filePath ?? "(unknown)"}, ` +
				`cannot register from ${filePath ?? "(unknown)"}.`,
		);
	}
	agents.set(config.name, {
		config,
		filePath,
		run: (input, ctx) => runAgent(config, input, ctx),
	});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerTool(
	config: ToolConfig<any, any>,
	filePath?: string,
): void {
	if (tools.has(config.name)) {
		const existing = tools.get(config.name);
		throw new Error(
			`Duplicate tool name "${config.name}": already registered from ${existing?.filePath ?? "(unknown)"}, ` +
				`cannot register from ${filePath ?? "(unknown)"}.`,
		);
	}
	tools.set(config.name, { config, filePath });
}

export function registerJob(config: JobConfig, filePath?: string): void {
	if (jobs.has(config.name)) {
		const existing = jobs.get(config.name);
		throw new Error(
			`Duplicate job name "${config.name}": already registered from ${existing?.filePath ?? "(unknown)"}, ` +
				`cannot register from ${filePath ?? "(unknown)"}.`,
		);
	}
	jobs.set(config.name, { config, filePath });
}

export function getAgent(name: string): RegisteredAgent {
	const a = agents.get(name);
	if (!a) throw new AgentNotFound(name, [...agents.keys()]);
	return a;
}

export function getTool(name: string): RegisteredTool {
	const t = tools.get(name);
	if (!t) throw new ToolNotFound(name, [...tools.keys()]);
	return t;
}

export function getJob(name: string): RegisteredJob | undefined {
	return jobs.get(name);
}

export function listAgents(): RegisteredAgent[] {
	return [...agents.values()];
}

export function listTools(): RegisteredTool[] {
	return [...tools.values()];
}

export function listJobs(): RegisteredJob[] {
	return [...jobs.values()];
}

export function hasAny(): boolean {
	return agents.size > 0 || tools.size > 0;
}

// Test-only — reset module state between test runs.
export function __resetRegistry(): void {
	agents.clear();
	tools.clear();
	jobs.clear();
}
