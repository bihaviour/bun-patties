import { isAbsolute, resolve } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { runBuild } from "./build.ts";
import { runDeploy } from "./commands/deploy.ts";
import { runMigrate } from "./commands/migrate.ts";
import { runSecret } from "./commands/secret.ts";
import { runUpgrade } from "./commands/upgrade.ts";
import { runDev } from "./dev.ts";
import { EXIT, log, setVerbose } from "./log.ts";
import { runRun } from "./run.ts";
import { notifyUpdate } from "./update-check.ts";

const FRAMEWORK_VERSION = (pkg as { version: string }).version;

export interface CliContext {
	cwd: string;
	configPath?: string;
	verbose: boolean;
}

export interface GlobalFlags extends CliContext {
	noUpdateCheck: boolean;
	rest: string[];
}

export async function main(argv: string[]): Promise<number> {
	const globals = extractGlobals(argv);
	setVerbose(globals.verbose);

	const [cmd, ...rest] = globals.rest;

	if (cmd === "--version" || cmd === "-v") {
		log.info(FRAMEWORK_VERSION);
		return EXIT.OK;
	}

	if (cmd === undefined || cmd === "help" || cmd === "--help" || cmd === "-h") {
		printHelp();
		return EXIT.OK;
	}

	const ctx: CliContext = {
		cwd: globals.cwd,
		configPath: globals.configPath,
		verbose: globals.verbose,
	};

	// Prints from cache (instant) and refreshes in the background; never blocks.
	await notifyUpdate(FRAMEWORK_VERSION, globals.noUpdateCheck);

	switch (cmd) {
		case "dev":
			return runDev(rest, ctx);
		case "build":
			return runBuild(rest, ctx);
		case "run":
			return runRun(rest, ctx);
		case "deploy":
			return runDeploy(rest, ctx);
		case "secret":
			return runSecret(rest, ctx);
		// The catalog commands pull in `patties-ui` (an optional dev-time dep).
		// Import them lazily so `dev`/`build`/`deploy`/`secret` run without it.
		case "add": {
			const { runAdd } = await import("./commands/add.ts");
			return runAdd(rest, ctx);
		}
		case "ui": {
			const { runUi } = await import("./commands/ui.ts");
			return runUi(rest, ctx);
		}
		case "view": {
			const { runView } = await import("./commands/view.ts");
			return runView(rest, ctx);
		}
		case "update": {
			const { runUpdate } = await import("./commands/update.ts");
			return runUpdate(rest, ctx);
		}
		case "upgrade":
			return runUpgrade(rest, ctx);
		case "migrate":
			return runMigrate(rest, ctx);
		default:
			log.error(`unknown command: ${cmd}`);
			printHelp();
			return EXIT.USAGE;
	}
}

function extractGlobals(argv: string[]): GlobalFlags {
	const rest: string[] = [];
	let cwd = process.cwd();
	let configPath: string | undefined;
	let verbose = false;
	let noUpdateCheck = false;

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--cwd") {
			const v = argv[++i];
			if (v !== undefined) cwd = absolutize(v);
		} else if (a.startsWith("--cwd=")) {
			cwd = absolutize(a.slice(6));
		} else if (a === "--config") {
			const v = argv[++i];
			if (v !== undefined) configPath = absolutize(v);
		} else if (a.startsWith("--config=")) {
			configPath = absolutize(a.slice(9));
		} else if (a === "--verbose") {
			verbose = true;
		} else if (a === "--no-update-check") {
			noUpdateCheck = true;
		} else {
			rest.push(a);
		}
	}
	return { cwd, configPath, verbose, noUpdateCheck, rest };
}

function absolutize(p: string): string {
	return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

function printHelp(): void {
	process.stdout.write(`patties — Bun-native full-stack meta-framework

Usage:
  patties <command> [flags]

Commands:
  dev      Start the dev server (bun --hot by default).
  build    Produce a production bundle for the configured target.
  run      Run a workspace task with output caching + affected detection.
  deploy   Build then dispatch to an installed deploy plugin.
  secret   Manage dev-time secrets in the OS keychain.
  add      Stamp UI components from patties-ui into your project.
  ui       UI catalog setup (patties ui init).
  view     Print a component's source before stamping.
  update   Re-stamp components from the catalog after showing the diff.
  upgrade  Update the project's patties dependency to the newest release.
  migrate  Codemods: radix imports / RTL logical properties.
  help     Show this message.

Global flags:
  --cwd <path>        Project root (default: process.cwd()).
  --config <path>     Explicit config file (default: discovery in cwd).
  --verbose           Verbose diagnostics (include stacks).
  --no-update-check   Skip the "update available" banner.
  --version, -v       Print version.
  --help,    -h       Show this message.
`);
}
