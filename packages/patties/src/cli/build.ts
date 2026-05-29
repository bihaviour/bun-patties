import { resolve } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { generateAgentsMd } from "../agents-md/generate.ts";
import { writeManifestToFile } from "../agents-md/write.ts";
import { build } from "../build/index.ts";
import { loadConfig } from "../config/load.ts";
import { assertPluginCompat, type Plugin } from "../plugin/index.ts";
import type { CliContext } from "./index.ts";
import { EXIT, formatError, log } from "./log.ts";

const FRAMEWORK_VERSION = (pkg as { version: string }).version;

export interface BuildArgs {
	target?: "bun" | "edge";
	outDir?: string;
	appDir?: string;
	compile?: boolean;
	mode: "development" | "production";
}

export async function runBuild(
	argv: string[],
	ctx: CliContext = { cwd: process.cwd(), verbose: false },
): Promise<number> {
	const args = parseArgs(argv, ctx.cwd);

	let loaded: Awaited<ReturnType<typeof loadConfig>>;
	try {
		loaded = await loadConfig({
			cwd: ctx.cwd,
			configPath: ctx.configPath,
			overrides: args.target ? { target: args.target } : undefined,
		});
	} catch (err) {
		const msg = (err as Error)?.message ?? String(err);
		log.error(msg);
		return EXIT.ERROR;
	}
	const { config } = loaded;

	const target = config.target;
	const appDir = args.appDir ?? config.appDir;
	const outDir = args.outDir ?? config.outDir;
	const compile = args.compile ?? config.adapter.bun.compile;

	if (compile && target === "edge") {
		log.error(
			'patties build: adapter.bun.compile is only supported with target "bun" (got target "edge"). Remove --compile or set target: "bun".',
		);
		return EXIT.ERROR;
	}

	const plugins = (config.plugins ?? []) as Plugin[];
	for (const p of plugins) assertPluginCompat(FRAMEWORK_VERSION, p);

	const t0 = performance.now();
	let result: Awaited<ReturnType<typeof build>> | undefined;
	let failure: Error | undefined;
	try {
		result = await build({
			appDir,
			outDir,
			target,
			mode: args.mode,
			compile,
			plugins,
		});
	} catch (err) {
		failure = err as Error;
	}
	const elapsedMs = performance.now() - t0;

	if (failure || !result) {
		printError(failure ?? new Error("build failed"));
		return EXIT.ERROR;
	}

	await printSummary(result, { target, outDir, elapsedMs });

	try {
		const md = await generateAgentsMd(appDir, {
			appDir,
			env: { required: config.env.required, optional: config.env.public },
			plugins,
		});
		const targets = agentsMdTargets(config.agentsMd.path);
		for (const t of targets) {
			await writeManifestToFile(`${ctx.cwd}/${t}`, md);
			log.success(`${t}: manifest section updated`);
		}
	} catch (err) {
		log.warn(
			`agent manifest generation failed: ${(err as Error)?.message ?? String(err)}`,
		);
	}
	return EXIT.OK;
}

function agentsMdTargets(path: string | string[]): string[] {
	const list = Array.isArray(path) ? path : [path];
	return list.map((p) => p.replace(/^\/+/, ""));
}

function printError(err: Error): void {
	process.stderr.write(
		`${formatError({ title: "Build failed", reason: err.message })}\n`,
	);
}

interface SummaryCtx {
	target: "bun" | "edge";
	outDir: string;
	elapsedMs: number;
}

async function printSummary(
	result: Awaited<ReturnType<typeof build>>,
	ctx: SummaryCtx,
): Promise<void> {
	log.success(
		`built ${ctx.target} target  (${(ctx.elapsedMs / 1000).toFixed(2)}s)`,
	);
	log.dim(`  out: ${ctx.outDir}`);
	const serverSize = await gzippedSize(result.serverEntry);
	log.dim(
		`  serverEntry: ${result.serverEntry} (${formatBytes(serverSize)} gz)`,
	);
	if (result.assets.length > 0) {
		log.dim(`  assets:`);
		for (const a of result.assets) {
			const size = await gzippedSize(a.dest);
			log.dim(`    ${a.publicPath}  ${formatBytes(size)} gz`);
		}
	}
	log.dim(
		`  counts: routes=${result.counts.routes} islands=${result.counts.islands} agents=${result.counts.agents} tools=${result.counts.tools} jobs=${result.counts.jobs}`,
	);
	if (result.artifacts.length > 0) {
		log.dim(`  artifacts: ${result.artifacts.join(", ")}`);
	}
}

async function gzippedSize(path: string): Promise<number> {
	try {
		const bytes = await Bun.file(path).bytes();
		return Bun.gzipSync(bytes).byteLength;
	} catch {
		return 0;
	}
}

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function parseArgs(argv: string[], cwd: string): BuildArgs {
	const out: BuildArgs = { mode: "production" };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--target") out.target = String(argv[++i]) as "bun" | "edge";
		else if (a.startsWith("--target="))
			out.target = a.slice(9) as "bun" | "edge";
		else if (a === "--out") out.outDir = resolve(cwd, String(argv[++i]));
		else if (a.startsWith("--out=")) out.outDir = resolve(cwd, a.slice(6));
		else if (a === "--app") out.appDir = resolve(cwd, String(argv[++i]));
		else if (a.startsWith("--app=")) out.appDir = resolve(cwd, a.slice(6));
		else if (a === "--compile") out.compile = true;
		else if (a === "--dev") out.mode = "development";
	}
	return out;
}
