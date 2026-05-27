import { isAbsolute, resolve } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { runBuild } from "./build.ts";
import { runAdd } from "./commands/add.ts";
import { runDeploy } from "./commands/deploy.ts";
import { runSecret } from "./commands/secret.ts";
import { runDev } from "./dev.ts";
import { EXIT, log, setVerbose } from "./log.ts";

const FRAMEWORK_VERSION = (pkg as { version: string }).version;

export interface CliContext {
	cwd: string;
	configPath?: string;
	verbose: boolean;
}

export interface GlobalFlags extends CliContext {
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

	switch (cmd) {
		case "dev":
			return runDev(rest, ctx);
		case "build":
			return runBuild(rest, ctx);
		case "deploy":
			return runDeploy(rest, ctx);
		case "secret":
			return runSecret(rest, ctx);
		case "add":
			return runAdd(rest, ctx);
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
		} else {
			rest.push(a);
		}
	}
	return { cwd, configPath, verbose, rest };
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
  deploy   Build then dispatch to an installed deploy plugin.
  secret   Manage dev-time secrets in the OS keychain.
  add      Stamp UI components from patties-ui into your project.
  help     Show this message.

Global flags:
  --cwd <path>      Project root (default: process.cwd()).
  --config <path>   Explicit config file (default: discovery in cwd).
  --verbose         Verbose diagnostics (include stacks).
  --version, -v     Print version.
  --help,    -h     Show this message.
`);
}
