import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { generateAgentsMd } from "../agents-md/generate.ts";
import { writeManifestToFile } from "../agents-md/write.ts";
import { MissingEnv, validateRequiredEnv } from "../config/env.ts";
import { loadConfig } from "../config/load.ts";
import { loadSecrets } from "../config/secrets.ts";
import { createDevServer } from "../dev/watcher.ts";
import { assertPluginCompat, type Plugin } from "../plugin/index.ts";
import { startServer } from "../server/index.ts";
import type { CliContext } from "./index.ts";
import { EXIT, installSigintHandler, log } from "./log.ts";

const FRAMEWORK_VERSION = (pkg as { version: string }).version;

export interface DevArgs {
	cold: boolean;
	port: number | null;
	host: string | null;
	appDir: string | null;
	noOpen: boolean;
}

const REEXEC_FLAG = "PATTIES_DEV_HOT";

export async function runDev(
	argv: string[],
	ctx: CliContext = { cwd: process.cwd(), verbose: false },
): Promise<number> {
	const args = parseArgs(argv, ctx.cwd);

	if (process.env[REEXEC_FLAG] !== "1") {
		return reexecUnderBun(args, ctx);
	}

	return bootstrap(args, ctx);
}

function parseArgs(argv: string[], cwd: string): DevArgs {
	const out: DevArgs = {
		cold: false,
		port: null,
		host: null,
		appDir: null,
		noOpen: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === undefined) continue;
		if (a === "--cold") out.cold = true;
		else if (a === "--no-open") out.noOpen = true;
		else if (a === "--port") out.port = Number(argv[++i]);
		else if (a === "--host") out.host = String(argv[++i]);
		else if (a === "--app") out.appDir = resolve(cwd, String(argv[++i]));
		else if (a.startsWith("--port=")) out.port = Number(a.slice(7));
		else if (a.startsWith("--host=")) out.host = a.slice(7);
		else if (a.startsWith("--app=")) out.appDir = resolve(cwd, a.slice(6));
	}
	return out;
}

interface ResolvedDev {
	port: number;
	host: string;
	appDir: string;
	unix: string | undefined;
	reusePort: boolean | undefined;
	requiredEnv: string[];
	secrets: string[];
}

async function resolveDev(
	args: DevArgs,
	ctx: CliContext,
): Promise<ResolvedDev> {
	const { config } = await loadConfig({
		cwd: ctx.cwd,
		configPath: ctx.configPath,
	});
	const envPort = process.env.PORT ? Number(process.env.PORT) : undefined;
	const envHost = process.env.HOST;
	return {
		port: args.port ?? envPort ?? config.server.port,
		host: args.host ?? envHost ?? config.server.hostname,
		appDir: args.appDir ?? config.appDir,
		unix: config.server.unix,
		reusePort: config.server.reusePort,
		requiredEnv: config.env.required,
		secrets: config.secrets,
	};
}

async function reexecUnderBun(args: DevArgs, ctx: CliContext): Promise<number> {
	const entry = resolveReexecEntry(ctx.cwd);
	const mode = args.cold ? "--watch" : "--hot";
	const passthrough: string[] = [];
	if (ctx.cwd !== process.cwd()) passthrough.push("--cwd", ctx.cwd);
	if (ctx.configPath) passthrough.push("--config", ctx.configPath);
	if (ctx.verbose) passthrough.push("--verbose");
	passthrough.push("dev");
	if (args.cold) passthrough.push("--cold");
	if (args.noOpen) passthrough.push("--no-open");
	if (args.port !== null) passthrough.push("--port", String(args.port));
	if (args.host !== null) passthrough.push("--host", args.host);
	if (args.appDir !== null) passthrough.push("--app", args.appDir);
	// `--preserve-symlinks` keeps module resolution rooted in the user's
	// project when `patties` is linked from a workspace / `bun link`. Without
	// it, framework files realpath into the framework's own `node_modules`,
	// loading a *second* copy of React alongside the app's — which breaks
	// hooks during SSR ("Invalid hook call").
	const proc = Bun.spawn(
		["bun", "--preserve-symlinks", mode, entry, ...passthrough],
		{
			stdio: ["inherit", "inherit", "inherit"],
			env: { ...process.env, [REEXEC_FLAG]: "1" },
		},
	);
	// Forward termination signals to the child so it doesn't get orphaned
	// (reparented to init) and keep holding the listen port.
	const forward = (sig: NodeJS.Signals) => {
		try {
			proc.kill(sig);
		} catch {}
	};
	const onInt = () => forward("SIGINT");
	const onTerm = () => forward("SIGTERM");
	const onHup = () => forward("SIGHUP");
	process.on("SIGINT", onInt);
	process.on("SIGTERM", onTerm);
	process.on("SIGHUP", onHup);
	try {
		const code = await proc.exited;
		return code ?? 0;
	} finally {
		process.off("SIGINT", onInt);
		process.off("SIGTERM", onTerm);
		process.off("SIGHUP", onHup);
	}
}

// Prefer the user-project copy of the bin (under their `node_modules/patties`)
// over `process.argv[1]`, which may have already been realpath'd to the linked
// framework checkout. Combined with `--preserve-symlinks`, this keeps module
// resolution anchored in the user's project so `react` / `react-dom` resolve
// to a single copy.
function resolveReexecEntry(cwd: string): string {
	const candidate = `${cwd}/node_modules/patties/bin/patties.ts`;
	if (existsSync(candidate)) return candidate;
	return process.argv[1] ?? "";
}

async function bootstrap(args: DevArgs, ctx: CliContext): Promise<number> {
	const { config } = await loadConfig({
		cwd: ctx.cwd,
		configPath: ctx.configPath,
	});
	const resolved = await resolveDev(args, ctx);

	await loadSecrets(config, { cwd: ctx.cwd });
	try {
		validateRequiredEnv(resolved.requiredEnv);
	} catch (err) {
		if (err instanceof MissingEnv) {
			log.error(err.message);
			return EXIT.ERROR;
		}
		throw err;
	}

	const plugins = (config.plugins ?? []) as Plugin[];
	for (const p of plugins) assertPluginCompat(FRAMEWORK_VERSION, p);

	const devServer = createDevServer({ appDir: resolved.appDir });

	for (const p of plugins) {
		const hook = p.hooks?.onDevStart;
		if (typeof hook !== "function") continue;
		try {
			await hook(devServer);
		} catch (err) {
			const msg = (err as Error)?.message ?? String(err);
			log.error(`[plugin ${p.name}] onDevStart: ${msg}`);
			return EXIT.ERROR;
		}
	}

	// Initial agent-manifest generation — fire-and-forget; never crashes dev.
	const agentsMdTargets = Array.isArray(config.agentsMd.path)
		? config.agentsMd.path
		: [config.agentsMd.path];
	generateAgentsMd(resolved.appDir, {
		appDir: resolved.appDir,
		env: { required: config.env.required, optional: config.env.public },
		plugins,
	})
		.then(async (md) => {
			for (const t of agentsMdTargets) {
				await writeManifestToFile(`${ctx.cwd}/${t.replace(/^\/+/, "")}`, md);
			}
		})
		.catch((err) =>
			log.warn(
				`agent manifest generation failed: ${(err as Error)?.message ?? String(err)}`,
			),
		);

	installSigintHandler();

	const entry = findUserEntry(resolved.appDir);
	if (entry) {
		const mod = (await import(entry)) as { default?: unknown };
		const start = mod.default as
			| ((opts: {
					devServer: typeof devServer;
					port: number;
					host: string;
					appDir: string;
			  }) => void | Promise<void>)
			| undefined;
		if (typeof start === "function") {
			await start({
				devServer,
				port: resolved.port,
				host: resolved.host,
				appDir: resolved.appDir,
			});
			printReady(resolved);
			return await new Promise<number>(() => {});
		}
		log.warn(`${entry} has no default export; starting a stub dev server.`);
	} else {
		log.warn(
			`no app entry found at ${resolved.appDir}/server.ts — starting a stub dev server.`,
		);
	}

	startServer({
		port: resolved.port,
		hostname: resolved.host,
		unix: resolved.unix,
		reusePort: resolved.reusePort,
		dev: true,
		devServer,
		routes: {
			"/": (() =>
				new Response("patties dev: no app entry. Create app/server.ts.", {
					status: 200,
				})) as never,
		},
		fallback: () => new Response("not found", { status: 404 }),
	});
	printReady(resolved);
	return await new Promise<number>(() => {});
}

function printReady(resolved: ResolvedDev): void {
	// URL banner is printed by startServer (Local + Network). Here we only
	// confirm dev mode is up and show the app root for orientation.
	log.success("▲ Patties dev ready");
	log.dim(`  root: ${resolved.appDir}`);
}

function findUserEntry(appDir: string): string | null {
	const candidates = [
		`${appDir}/server.ts`,
		`${appDir}/server.tsx`,
		`${appDir}/index.ts`,
	];
	for (const c of candidates) if (existsSync(c)) return c;
	return null;
}
