#!/usr/bin/env bun
// Generate the /patties pattern guidance for both agents from one source
// (cli spec 19). The Claude skill and the Codex rule share the catalog body
// verbatim so they cannot drift.
//
//   bun run generate:patties-skill          # write both files
//   bun run generate:patties-skill --check  # fail if regeneration would change them
//
// Edit templates/_shared/patties-patterns.md — never the generated files.

import { dirname, resolve } from "node:path";

const PKG_ROOT = resolve(dirname(import.meta.dir));
const SOURCE = resolve(PKG_ROOT, "templates/_shared/patties-patterns.md");
const CLAUDE_OUT = resolve(
	PKG_ROOT,
	"templates/_claude/.claude/skills/patties/SKILL.md",
);
const CODEX_OUT = resolve(
	PKG_ROOT,
	"templates/_codex/.codex/rules/patties-patterns.md",
);

const CLAUDE_FRONT_MATTER = `---
name: patties
description: Use when adding a Patties UI component or scaffolding a feature pattern (auth + RBAC, CRM, task board, pivot table, dashboard). Trigger phrases include "add a component", "scaffold a CRM / dashboard / auth", "patties pattern", "/patties".
---

# /patties — components & feature patterns
`;

const CODEX_HEADER = `# Patties patterns — components & feature scaffolding

> Codex rule. The catalog and recipes below are shared verbatim with the
> Claude \`/patties\` skill — both are generated from one source
> (\`templates/_shared/patties-patterns.md\` in create-patties), so they
> cannot drift. Read this when the user asks to add a component or scaffold a
> feature pattern.
`;

// Drop the leading authoring comment; outputs start at the first heading.
function body(source: string): string {
	const start = source.indexOf("## When to use");
	if (start === -1)
		throw new Error("source is missing the '## When to use' heading");
	return source.slice(start);
}

function render(source: string): { claude: string; codex: string } {
	const b = body(source);
	return {
		claude: `${CLAUDE_FRONT_MATTER}\n${b}`,
		codex: `${CODEX_HEADER}\n${b}`,
	};
}

async function main(): Promise<number> {
	const check = process.argv.includes("--check");
	const source = await Bun.file(SOURCE).text();
	const { claude, codex } = render(source);
	const targets: Array<[string, string]> = [
		[CLAUDE_OUT, claude],
		[CODEX_OUT, codex],
	];

	if (check) {
		const stale: string[] = [];
		for (const [path, want] of targets) {
			const got = (await Bun.file(path).exists())
				? await Bun.file(path).text()
				: "";
			if (got !== want) stale.push(path);
		}
		if (stale.length > 0) {
			process.stderr.write(
				`patties-skill is out of date:\n${stale.map((p) => `  - ${p}`).join("\n")}\n` +
					"Run `bun run generate:patties-skill` and commit the result.\n",
			);
			return 1;
		}
		process.stdout.write("patties-skill is up to date.\n");
		return 0;
	}

	for (const [path, contents] of targets) {
		await Bun.write(path, contents);
		process.stdout.write(`wrote ${path}\n`);
	}
	return 0;
}

process.exit(await main());
