import type { CliContext } from "../index.ts";
import { EXIT } from "../log.ts";
import { runUiInit, type UiInitArgs } from "./ui/init.ts";

// `patties ui <sub>` subcommand group. Currently `init`; `build` arrives with
// the registry-distribution work (cli/15).
export async function runUi(argv: string[], ctx: CliContext): Promise<number> {
	const [sub, ...rest] = argv;

	if (sub === undefined || sub === "help" || sub === "--help" || sub === "-h") {
		printHelp();
		return EXIT.OK;
	}

	switch (sub) {
		case "init":
			return runUiInit(parseInitArgs(rest), ctx);
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

function printHelp(): void {
	process.stdout.write(`patties ui — UI catalog setup

Usage:
  patties ui init [--dry-run] [--force] [--theme <name>]

Subcommands:
  init    Lay down tokens, the cn helper, and Tailwind wiring before stamping.
`);
}
