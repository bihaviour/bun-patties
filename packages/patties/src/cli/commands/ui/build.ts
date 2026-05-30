import { isAbsolute, join, resolve } from "node:path";
import { ComponentEntrySchema } from "patties-ui/schema";
import type { ComponentEntry } from "patties-ui/types";
import type { CliContext } from "../../index.ts";
import { EXIT, log } from "../../log.ts";
import {
	type ComponentPayload,
	requiredTemplatePaths,
} from "../add/registry-fetch.ts";

export interface UiBuildArgs {
	out?: string;
	outMissing: boolean;
	registry?: string;
	templates?: string;
	help: boolean;
}

// `patties ui build` — the inverse of the remote-fetch path: read a hand-
// maintained `registry.ts` + `templates/` and emit a static, fetchable
// `registry.json` plus one `<name>.json` per component with inlined source, so a
// third-party publisher's catalog can be consumed by `patties add` (cli/15).
// Pure transform: no network, no install.
export async function runUiBuild(
	args: UiBuildArgs,
	ctx: CliContext,
): Promise<number> {
	if (args.help) {
		printHelp();
		return EXIT.OK;
	}
	if (args.outMissing || !args.out) {
		log.error("--out <dir> is required.");
		return EXIT.USAGE;
	}

	const abs = (p: string): string => (isAbsolute(p) ? p : resolve(ctx.cwd, p));
	const registryPath = abs(args.registry ?? "registry.ts");
	const templatesDir = abs(args.templates ?? "templates");
	const outDir = abs(args.out);

	if (!(await Bun.file(registryPath).exists())) {
		log.error(`registry not found: ${registryPath}`);
		return EXIT.USAGE;
	}

	const mod = (await import(registryPath)) as { components?: unknown };
	if (!Array.isArray(mod.components)) {
		log.error(`${registryPath} does not export a \`components\` array`);
		return EXIT.USAGE;
	}

	const entries: ComponentEntry[] = [];
	for (const raw of mod.components) {
		const parsed = ComponentEntrySchema.safeParse(raw);
		if (!parsed.success) {
			const name = (raw as { name?: unknown })?.name ?? "<unknown>";
			log.error(
				`entry ${String(name)} failed validation: ${parsed.error.issues
					.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
					.join("; ")}`,
			);
			return EXIT.USAGE;
		}
		entries.push(parsed.data);
	}

	for (const entry of entries) {
		const templates: Record<string, string> = {};
		for (const rel of requiredTemplatePaths(entry)) {
			const file = Bun.file(join(templatesDir, rel));
			if (!(await file.exists())) {
				log.error(
					`component ${entry.name}: template not found: ${join(templatesDir, rel)}`,
				);
				return EXIT.USAGE;
			}
			templates[rel] = await file.text();
		}
		const payload: ComponentPayload = { entry, templates };
		await Bun.write(
			join(outDir, `${entry.name}.json`),
			`${JSON.stringify(payload, null, "\t")}\n`,
		);
		log.success(`  ${entry.name}.json`);
	}

	await Bun.write(
		join(outDir, "registry.json"),
		`${JSON.stringify({ components: entries }, null, "\t")}\n`,
	);
	log.success(`  registry.json (${entries.length} components)`);
	log.dim(`done. Emitted ${entries.length + 1} files to ${outDir}.`);
	return EXIT.OK;
}

function printHelp(): void {
	process.stdout.write(`patties ui build — compile a fetchable registry

Usage:
  patties ui build --out <dir> [--registry <path>] [--templates <dir>]

Reads a registry.ts + templates/ and emits registry.json plus one <name>.json
per component with inlined source. For third-party registry authors.

Flags:
  --out <dir>        Output directory (required).
  --registry <path>  Registry module (default: ./registry.ts).
  --templates <dir>  Templates directory (default: ./templates).
`);
}
