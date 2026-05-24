import { resolve } from "node:path";
import { generateAgentsMd } from "../agents-md/generate.ts";
import { build } from "../build/index.ts";
import { loadConfig } from "../config/load.ts";
import { assertPluginCompat, type Plugin } from "../plugin/index.ts";
import pkg from "../../package.json" with { type: "json" };

const FRAMEWORK_VERSION = (pkg as { version: string }).version;

export interface BuildArgs {
	target?: "bun" | "edge";
	outDir?: string;
	appDir?: string;
	compile?: boolean;
	mode: "development" | "production";
}

export async function runBuild(argv: string[]): Promise<number> {
	const args = parseArgs(argv);
	const { config } = await loadConfig(process.cwd());

	const target = args.target ?? config.target;
	const appDir = args.appDir ?? config.appDir;
	const outDir = args.outDir ?? config.outDir;
	const compile = args.compile ?? config.adapter.bun.compile;

	if ((target as string) === "node") {
		console.error(`patties build: invalid target "node". Allowed: bun, edge.`);
		return 1;
	}

	const plugins = (config.plugins ?? []) as Plugin[];
	for (const p of plugins) assertPluginCompat(FRAMEWORK_VERSION, p);

	const result = await build({
		appDir,
		outDir,
		target,
		mode: args.mode,
		compile,
		plugins,
	});

	console.log(`[patties] built ${target} target`);
	console.log(`[patties]   serverEntry: ${result.serverEntry}`);
	console.log(`[patties]   assets: ${result.assets.length}`);

	try {
		const md = await generateAgentsMd(appDir, {
			appDir,
			env: { required: config.env.required, optional: config.env.public },
			plugins,
		});
		await Bun.write(process.cwd() + "/AGENTS.md", md);
		console.log(`[patties]   AGENTS.md: written`);
	} catch (err) {
		console.warn(
			`[patties] AGENTS.md generation failed:`,
			(err as Error)?.message ?? err,
		);
	}
	return 0;
}

function parseArgs(argv: string[]): BuildArgs {
	const out: BuildArgs = { mode: "production" };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		if (a === "--target") out.target = String(argv[++i]) as "bun" | "edge";
		else if (a.startsWith("--target="))
			out.target = a.slice(9) as "bun" | "edge";
		else if (a === "--out")
			out.outDir = resolve(process.cwd(), String(argv[++i]));
		else if (a.startsWith("--out="))
			out.outDir = resolve(process.cwd(), a.slice(6));
		else if (a === "--app")
			out.appDir = resolve(process.cwd(), String(argv[++i]));
		else if (a.startsWith("--app="))
			out.appDir = resolve(process.cwd(), a.slice(6));
		else if (a === "--compile") out.compile = true;
		else if (a === "--dev") out.mode = "development";
	}
	return out;
}
