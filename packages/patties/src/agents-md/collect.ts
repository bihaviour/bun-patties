import { scanAgents, scanJobs, scanTools } from "../ai/scan.ts";
import { scanIslands } from "../build/scan-islands.ts";
import { scanRoutes } from "../router/filesystem.ts";
import type { RouteEntry } from "../types.ts";
import { type ModuleResult, runSubprocessBatch } from "./subprocess-runner.ts";

export interface CollectedData {
	routes: RouteEntry[];
	islands: Array<{ name: string; relPath: string }>;
	agents: Array<{
		name: string;
		filePath: string;
		ok: boolean;
		data?: unknown;
		error?: string;
	}>;
	tools: Array<{
		name: string;
		filePath: string;
		ok: boolean;
		data?: unknown;
		error?: string;
	}>;
	jobs: Array<{
		name: string;
		filePath: string;
		ok: boolean;
		data?: unknown;
		error?: string;
	}>;
	middlewareDocComment: string | null;
	envVars: Array<{ name: string; required: boolean; description?: string }>;
}

export async function collect(
	appDir: string,
	env: Array<{ name: string; required: boolean; description?: string }>,
): Promise<CollectedData> {
	const [routes, islands, agentMods, toolMods, jobMods, middlewareDocComment] =
		await Promise.all([
			scanRoutes(appDir).catch(() => [] as RouteEntry[]),
			scanIslands(appDir).catch(() => []),
			scanAgents(appDir),
			scanTools(appDir),
			scanJobs(appDir),
			extractMiddlewareDocComment(appDir),
		]);

	const queries = [
		...agentMods.map((a) => ({ kind: "agent" as const, file: a.filePath })),
		...toolMods.map((t) => ({ kind: "tool" as const, file: t.filePath })),
		...jobMods.map((j) => ({ kind: "job" as const, file: j.filePath })),
	];

	let subResults: ModuleResult[] = [];
	if (queries.length > 0) {
		const entryScript = resolveSubprocessEntry();
		subResults = await runSubprocessBatch(entryScript, queries);
	}

	let cursor = 0;
	const agents = agentMods.map((a) => mapResult(a, subResults[cursor++]));
	const tools = toolMods.map((t) => mapResult(t, subResults[cursor++]));
	const jobs = jobMods.map((j) => mapResult(j, subResults[cursor++]));

	return {
		routes,
		islands: islands.map((i) => ({ name: i.name, relPath: i.relPath })),
		agents,
		tools,
		jobs,
		middlewareDocComment,
		envVars: env,
	};
}

function mapResult(
	mod: { name: string; filePath: string },
	r: ModuleResult | undefined,
): {
	name: string;
	filePath: string;
	ok: boolean;
	data?: unknown;
	error?: string;
} {
	if (!r) return { ...mod, ok: false, error: "no subprocess result" };
	return { ...mod, ok: r.ok, data: r.data, error: r.error };
}

async function extractMiddlewareDocComment(
	appDir: string,
): Promise<string | null> {
	const path = `${appDir.replace(/\/+$/, "")}/middleware.ts`;
	const f = Bun.file(path);
	if (!(await f.exists())) return null;
	const text = await f.text();
	// Look for a leading /** ... */ block comment at the top of the file.
	const m = text.match(/^\s*\/\*\*([\s\S]*?)\*\//);
	if (!m) return null;
	return (
		m[1]
			?.split("\n")
			.map((l) => l.replace(/^\s*\*\s?/, "").trim())
			.filter((l) => l.length > 0)
			.join(" ") ?? null
	);
}

function resolveSubprocessEntry(): string {
	// import.meta.dir points at src/agents-md/ when running from source.
	return `${import.meta.dir}/subprocess-entry.ts`;
}
