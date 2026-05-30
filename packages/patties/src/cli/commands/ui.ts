import type { CliContext } from "../index.ts";
import { EXIT } from "../log.ts";
import { runUiBuild, type UiBuildArgs } from "./ui/build.ts";
import { runUiInit, type UiInitArgs } from "./ui/init.ts";

// `patties ui <sub>` subcommand group: `init` (scaffold) and `build` (compile a
// fetchable registry for third-party authors, cli/15).
export async function runUi(argv: string[], ctx: CliContext): Promise<number> {
	const [sub, ...rest] = argv;

	if (sub === undefined || sub === "help" || sub === "--help" || sub === "-h") {
		printHelp();
		return EXIT.OK;
	}

	switch (sub) {
		case "init":
			return runUiInit(parseInitArgs(rest), ctx);
		case "build":
			return runUiBuild(parseBuildArgs(rest), ctx);
		default:
			printHelp();
			return EXIT.USAGE;
	}
}

function parseInitArgs(argv: string[]): UiInitArgs {
	const out: UiInitArgs = { dryRun: false, force: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--dry-run") out.dryRun = true;
		else if (a === "--force") out.force = true;
		else if (a === "--theme") {
			const v = argv[++i];
			if (v === undefined) out.themeMissing = true;
			else out.theme = v;
		} else if (a.startsWith("--theme=")) {
			out.theme = a.slice("--theme=".length);
		}
	}
	return out;
}

function parseBuildArgs(argv: string[]): UiBuildArgs {
	const out: UiBuildArgs = { outMissing: false, help: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--help" || a === "-h") out.help = true;
		else if (a === "--out") {
			const v = argv[++i];
			if (v === undefined) out.outMissing = true;
			else out.out = v;
		} else if (a.startsWith("--out=")) {
			out.out = a.slice("--out=".length);
		} else if (a === "--registry") {
			const v = argv[++i];
			if (v !== undefined) out.registry = v;
		} else if (a.startsWith("--registry=")) {
			out.registry = a.slice("--registry=".length);
		} else if (a === "--templates") {
			const v = argv[++i];
			if (v !== undefined) out.templates = v;
		} else if (a.startsWith("--templates=")) {
			out.templates = a.slice("--templates=".length);
		}
	}
	return out;
}

function printHelp(): void {
	process.stdout.write(`patties ui — UI catalog setup

Usage:
  patties ui init [--dry-run] [--force] [--theme <name>]
  patties ui build --out <dir> [--registry <path>] [--templates <dir>]

Subcommands:
  init    Lay down tokens, the cn helper, and Tailwind wiring before stamping.
  build   Compile a fetchable registry.json + per-component JSON (for authors).
`);
}
