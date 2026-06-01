// Group C — project config validity. C.7 loads patties.config through the real
// loader (so a Zod violation surfaces with its issue path); C.8 confirms an
// existing biome.json is well-formed JSON. Validity only — biome owns lint.

import { join } from "node:path";
import { loadConfig } from "../../config/load.ts";
import type { Finding } from "./types.ts";

/** First `  - <path>: <msg>` line from a loader error, or the first line. */
function firstIssue(message: string): string {
	const lines = message.split("\n");
	const issue = lines.find((l) => l.trim().startsWith("- "));
	return (issue ?? lines[0] ?? "").trim().replace(/^- /, "");
}

export async function checkConfig(
	cwd: string,
	configPath?: string,
): Promise<Finding[]> {
	const out: Finding[] = [];

	try {
		await loadConfig({ cwd, configPath });
		out.push({
			id: "config",
			group: "Config",
			status: "pass",
			detail: "patties.config.ts valid",
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		out.push({
			id: "config",
			group: "Config",
			status: "fail",
			detail: `patties.config.ts invalid — ${firstIssue(message)}`,
			remedy: "fix patties.config.ts and re-run",
		});
	}

	const biomePath = join(cwd, "biome.json");
	if (await Bun.file(biomePath).exists()) {
		try {
			JSON.parse(await Bun.file(biomePath).text());
			out.push({
				id: "biome",
				group: "Config",
				status: "pass",
				detail: "biome.json valid",
			});
		} catch {
			out.push({
				id: "biome",
				group: "Config",
				status: "fail",
				detail: "biome.json is not valid JSON",
				remedy: "fix the JSON syntax in biome.json",
			});
		}
	}

	return out;
}
