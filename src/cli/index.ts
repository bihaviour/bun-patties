import { runBuild } from "./build.ts";
import { runDev } from "./dev.ts";

export async function main(argv: string[]): Promise<number> {
	const [cmd, ...rest] = argv;
	switch (cmd) {
		case "dev":
			return runDev(rest);
		case "build":
			return runBuild(rest);
		case undefined:
		case "help":
		case "--help":
		case "-h":
			printHelp();
			return 0;
		default:
			console.error(`patties: unknown command "${cmd}"`);
			printHelp();
			return 1;
	}
}

function printHelp(): void {
	console.log(`patties — Bun-native full-stack meta-framework

Usage:
  patties dev [--cold] [--port N] [--host H] [--app DIR]
  patties build [--target bun|edge] [--out DIR] [--app DIR] [--compile] [--dev]

Commands:
  dev    Start the development server (bun --hot by default, --cold for bun --watch).
  build  Produce a production bundle for the configured target.
`);
}
