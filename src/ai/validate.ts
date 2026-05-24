import type { AgentConfig, JobConfig, ToolConfig } from "./types.ts";

export interface NamedModule<T> {
	expectedName: string;
	filePath: string;
	config: T;
}

// Verifies filename basename === config.name, and collects duplicates. Throws
// one combined error listing every problem so devs see them all at once.
export function validateNamedModules(
	kind: "agent" | "tool" | "job",
	mods: NamedModule<{ name: string }>[],
): void {
	const problems: string[] = [];
	const byName = new Map<string, NamedModule<{ name: string }>>();

	for (const m of mods) {
		if (m.config.name !== m.expectedName) {
			problems.push(
				`${m.filePath}: ${kind} name "${m.config.name}" does not match filename basename "${m.expectedName}".`,
			);
			continue;
		}
		const prior = byName.get(m.config.name);
		if (prior) {
			problems.push(
				`Duplicate ${kind} name "${m.config.name}" in ${prior.filePath} and ${m.filePath}.`,
			);
			continue;
		}
		byName.set(m.config.name, m);
	}

	if (problems.length > 0) {
		throw new Error(
			`patties: ${kind} validation failed\n  ` + problems.join("\n  "),
		);
	}
}

export function validateAgentToolReferences(
	agents: NamedModule<AgentConfig>[],
	tools: NamedModule<ToolConfig>[],
): void {
	const toolNames = new Set(tools.map((t) => t.config.name));
	const problems: string[] = [];
	for (const a of agents) {
		for (const tname of a.config.tools ?? []) {
			if (!toolNames.has(tname)) {
				problems.push(
					`${a.filePath}: agent "${a.config.name}" references unknown tool "${tname}".`,
				);
			}
		}
	}
	if (problems.length > 0) {
		throw new Error(
			"patties: agent tool reference validation failed\n  " +
				problems.join("\n  "),
		);
	}
}

export function validateJobs(jobs: NamedModule<JobConfig>[]): void {
	const problems: string[] = [];
	for (const j of jobs) {
		if (!j.config.schedule || typeof j.config.schedule !== "string") {
			problems.push(
				`${j.filePath}: job "${j.config.name}" missing "schedule".`,
			);
		}
		if (!j.config.tz || typeof j.config.tz !== "string") {
			problems.push(
				`${j.filePath}: job "${j.config.name}" missing required "tz" (explicit timezone required — no implicit process TZ).`,
			);
		}
	}
	if (problems.length > 0) {
		throw new Error(
			"patties: job validation failed\n  " + problems.join("\n  "),
		);
	}
}
