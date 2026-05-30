import type { BuildOptions, BuildResult } from "../build/index.ts";
import type { DevServer } from "../dev/watcher.ts";
import type { Handler, Middleware } from "../middleware/index.ts";
import type { HTTPMethod } from "../types.ts";

export interface PluginLogger {
	info(msg: string, ...args: unknown[]): void;
	warn(msg: string, ...args: unknown[]): void;
	error(msg: string, ...args: unknown[]): void;
}

export interface PluginContext {
	config: unknown;
	root: string;
	logger: PluginLogger;
}

export interface PluginServer {
	route(pattern: string, methods: Partial<Record<HTTPMethod, Handler>>): void;
	use(middleware: Middleware): void;
}

export interface JobSummary {
	name: string;
	schedule?: string;
	tz?: string;
	filePath?: string;
}

export interface AgentsMdDocument {
	markdown: string;
}

export interface PluginHooks {
	onBuildStart?(opts: BuildOptions): void | Promise<void>;
	onBuildEnd?(result: BuildResult): void | Promise<void>;
	onDevStart?(server: DevServer): void | Promise<void>;
	onAgentsMdGenerate?(
		doc: AgentsMdDocument,
	): AgentsMdDocument | Promise<AgentsMdDocument>;
	onJobsCollect?(jobs: JobSummary[]): void | Promise<void>;
}

export interface Plugin {
	name: string;
	compat?: string;
	setup?(server: PluginServer, ctx: PluginContext): void | Promise<void>;
	hooks?: PluginHooks;
}

export interface DeployArtifacts {
	outDir: string;
	serverEntry: string;
}

export interface DeployContext {
	env?: string;
	cwd: string;
	logger: PluginLogger;
}

export interface DeployPlugin extends Plugin {
	deployTarget: "bun" | "edge";
	deploy(
		artifacts: DeployArtifacts,
		ctx: DeployContext,
	): Promise<string | undefined>;
}

export function isDeployPlugin(p: Plugin): p is DeployPlugin {
	const dp = p as Partial<DeployPlugin>;
	return (
		(dp.deployTarget === "bun" || dp.deployTarget === "edge") &&
		typeof dp.deploy === "function"
	);
}

export function definePlugin(p: Plugin): Plugin {
	if (!p || typeof p.name !== "string" || p.name.length === 0) {
		throw new Error("definePlugin: `name` is required");
	}
	return p;
}

export function assertPluginCompat(
	frameworkVersion: string,
	plugin: Plugin,
	logger: PluginLogger = console,
): void {
	if (!plugin.compat) {
		logger.warn(
			`[patties] plugin "${plugin.name}" has no \`compat\` range — pinning is encouraged.`,
		);
		return;
	}
	const semver = (
		Bun as unknown as { semver?: { satisfies(v: string, r: string): boolean } }
	).semver;
	if (!semver || typeof semver.satisfies !== "function") {
		// No-op when Bun.semver isn't available (non-Bun runtime in tests).
		return;
	}
	if (!semver.satisfies(frameworkVersion, plugin.compat)) {
		throw new Error(
			`[plugin ${plugin.name}] incompatible with framework version ${frameworkVersion} (requires ${plugin.compat})`,
		);
	}
}

export type { BuildOptions, BuildResult, DevServer };
