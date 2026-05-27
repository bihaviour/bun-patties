import type { CollectedData } from "./collect.ts";

// Deterministic Markdown rendering. Stable section order; alphabetical sort
// inside each section; canonical JSON in code blocks. Byte-identical for
// identical input — required by spec 11 acceptance.
export function render(data: CollectedData): string {
	const out: string[] = [];
	out.push("## Patties manifest", "");
	out.push(
		"> Generated section — do not edit by hand; surrounding content is preserved.",
		"",
	);

	out.push("## Route map", "");
	if (data.routes.length === 0) {
		out.push("_No routes._", "");
	} else {
		out.push("| File | URL | Methods |", "|---|---|---|");
		const rows = data.routes
			.map((r) => ({
				file: relPath(r.filePath),
				pattern: r.bunPattern,
				methods: r.kind === "page" ? "GET" : "(see source)",
			}))
			.sort((a, b) => a.file.localeCompare(b.file));
		for (const r of rows)
			out.push(`| ${r.file} | ${r.pattern} | ${r.methods} |`);
		out.push("");
	}

	out.push("## Islands", "");
	if (data.islands.length === 0) {
		out.push("_No islands._", "");
	} else {
		out.push("| Name | Source |", "|---|---|");
		const rows = [...data.islands].sort((a, b) => a.name.localeCompare(b.name));
		for (const i of rows) out.push(`| ${i.name} | ${i.relPath} |`);
		out.push("");
	}

	out.push("## Agents", "");
	if (data.agents.length === 0) {
		out.push("_No agents._", "");
	} else {
		out.push("| Name | Model | Tools | Triggers |", "|---|---|---|---|");
		const rows = [...data.agents].sort((a, b) => a.name.localeCompare(b.name));
		for (const a of rows) {
			if (!a.ok) {
				out.push(
					`| ${a.name} | _error_ | _error_ | _error: ${escapeCell(a.error ?? "unknown")}_ |`,
				);
				continue;
			}
			const d = a.data as {
				model?: string;
				tools?: string[];
				triggers?: string[];
			};
			out.push(
				`| ${a.name} | ${escapeCell(d.model ?? "")} | ${escapeCell((d.tools ?? []).join(", "))} | ${escapeCell((d.triggers ?? []).join(", "))} |`,
			);
		}
		out.push("");
	}

	out.push("## Tools", "");
	if (data.tools.length === 0) {
		out.push("_No tools._", "");
	} else {
		const rows = [...data.tools].sort((a, b) => a.name.localeCompare(b.name));
		for (const t of rows) {
			out.push(`### \`${t.name}\``, "");
			if (!t.ok) {
				out.push(`_error: ${t.error ?? "unknown"}_`, "");
				continue;
			}
			const d = t.data as { description?: string; input?: unknown };
			out.push(d.description ?? "_(no description)_", "", "Input schema:", "");
			out.push("```json", canonicalJson(d.input ?? {}), "```", "");
		}
	}

	out.push("## Jobs", "");
	if (data.jobs.length === 0) {
		out.push("_No jobs._", "");
	} else {
		out.push("| Name | Schedule | TZ |", "|---|---|---|");
		const rows = [...data.jobs].sort((a, b) => a.name.localeCompare(b.name));
		for (const j of rows) {
			if (!j.ok) {
				out.push(
					`| ${j.name} | _error_ | _error: ${escapeCell(j.error ?? "unknown")}_ |`,
				);
				continue;
			}
			const d = j.data as { schedule?: string; tz?: string };
			out.push(
				`| ${j.name} | ${escapeCell(d.schedule ?? "")} | ${escapeCell(d.tz ?? "")} |`,
			);
		}
		out.push("");
	}

	out.push("## Middleware", "");
	if (data.middlewareDocComment) {
		out.push(data.middlewareDocComment, "");
	} else {
		out.push("_No global middleware._", "");
	}

	out.push("## Environment variables", "");
	if (data.envVars.length === 0) {
		out.push("_No declared env vars._", "");
	} else {
		out.push("| Name | Required | Description |", "|---|---|---|");
		const rows = [...data.envVars].sort((a, b) => a.name.localeCompare(b.name));
		for (const e of rows) {
			out.push(
				`| ${e.name} | ${e.required ? "yes" : "no"} | ${escapeCell(e.description ?? "")} |`,
			);
		}
		out.push("");
	}

	return out.join("\n");
}

function relPath(absPath: string): string {
	const cwd = process.cwd().replace(/\/+$/, "");
	if (absPath.startsWith(`${cwd}/`)) return absPath.slice(cwd.length + 1);
	return absPath;
}

function escapeCell(s: string): string {
	return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function canonicalJson(value: unknown): string {
	return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value && typeof value === "object") {
		const obj = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k]);
		return out;
	}
	return value;
}
