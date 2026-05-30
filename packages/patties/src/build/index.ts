import { bunAdapter } from "../adapters/bun.ts";
import { edgeAdapter } from "../adapters/edge.ts";
import type { Adapter } from "../adapters/types.ts";
import { scanAgents, scanJobs, scanTools } from "../ai/scan.ts";
import type { JobSummary, Plugin } from "../plugin/index.ts";
import { scanRoutes } from "../router/filesystem.ts";
import { type BuiltAsset, copyAssets } from "./assets.ts";
import { generateClientEntry } from "./client-entry.ts";
import {
	collectClientChunks,
	type EmbeddedEntry,
	generateEmbeddedManifest,
} from "./embedded.ts";
import { type IslandEntry, scanIslands } from "./scan-islands.ts";
import { generateServerEntry } from "./server-entry.ts";

export type { BuiltAsset };

export interface ClientManifest {
	entry: string | null;
	islands: Record<string, string>;
}

export interface BuildCounts {
	routes: number;
	islands: number;
	agents: number;
	tools: number;
	jobs: number;
}

export interface BuildResult {
	clientManifest: ClientManifest;
	serverEntry: string;
	assets: BuiltAsset[];
	counts: BuildCounts;
	artifacts: string[];
}

export interface BuildOptions {
	appDir: string;
	outDir?: string;
	target?: "bun" | "edge";
	mode?: "development" | "production";
	port?: number;
	// Emit a single standalone executable (Bun runtime + bundle) via
	// `bun build --compile`. Only honored when target === "bun" && mode ===
	// "production"; otherwise silently ignored. See spec 04 §"Single-binary
	// executable".
	compile?: boolean;
	plugins?: Plugin[];
}

const PUBLIC_PREFIX = "/_patties/client/";

export async function build(options: BuildOptions): Promise<BuildResult> {
	const appDir = absolutize(options.appDir);
	const outDir = absolutize(options.outDir ?? ".patties");
	const target = options.target ?? "bun";
	const mode = options.mode ?? "production";
	const plugins = options.plugins ?? [];

	if (options.compile === true && target === "edge") {
		throw new Error(
			'patties build: adapter.bun.compile is only supported with target "bun" (got target "edge"). Remove --compile or set target: "bun".',
		);
	}
	// Compile path: embed assets into the binary. Bun + production only.
	const compile =
		options.compile === true && target === "bun" && mode === "production";

	for (const p of plugins) {
		if (!p.hooks?.onBuildStart) continue;
		try {
			await p.hooks.onBuildStart(options);
		} catch (err) {
			throw wrapHookError(p.name, "onBuildStart", err);
		}
	}

	// genDir lives under appDir so generated entries can resolve react/react-dom
	// via the normal upward node_modules walk. outDir holds only built artifacts.
	const genDir = `${appDir}/patties-gen`;
	const clientOutDir = `${outDir}/client`;
	const serverOutDir = `${outDir}/server`;

	const islands = await scanIslands(appDir);
	const entries = await scanRoutes(appDir);
	const agentMods = await scanAgents(appDir);
	const toolMods = await scanTools(appDir);
	const jobMods = await scanJobs(appDir);
	const hasUserMiddleware = await Bun.file(`${appDir}/middleware.ts`).exists();

	if (plugins.length > 0) {
		const summary: JobSummary[] = jobMods.map((j) => ({
			name: j.name,
			filePath: j.filePath,
		}));
		for (const p of plugins) {
			if (!p.hooks?.onJobsCollect) continue;
			try {
				await p.hooks.onJobsCollect(summary);
			} catch (err) {
				throw wrapHookError(p.name, "onJobsCollect", err);
			}
		}
	}

	const manifest: ClientManifest = { entry: null, islands: {} };
	const frameworkRoot = resolveFrameworkRoot();

	if (islands.length > 0) {
		const clientEntryPath = `${genDir}/client-entry.ts`;
		await Bun.write(
			clientEntryPath,
			generateClientEntry(islands, { frameworkRoot }),
		);

		const clientResult = await Bun.build({
			entrypoints: [clientEntryPath],
			target: "browser",
			splitting: true,
			minify: mode === "production",
			outdir: clientOutDir,
			naming: "[name]-[hash].[ext]",
		});

		if (!clientResult.success) {
			const msgs = clientResult.logs
				.map((l) => l.message ?? String(l))
				.join("\n");
			throw new Error(`patties build: client bundle failed\n${msgs}`);
		}

		populateClientManifest(
			manifest,
			clientResult.outputs,
			clientEntryPath,
			islands,
			clientOutDir,
		);
	} else {
		// Zero-island project: write nothing to client/, leave manifest empty.
		await Bun.write(
			`${genDir}/client-entry.ts`,
			generateClientEntry([], { frameworkRoot }),
		);
	}

	// Manifest must hit disk before the server entry is generated — the server
	// entry pulls it back in via the MANIFEST macro, which reads from this path
	// at bundle time.
	const manifestPath = `${outDir}/manifest.json`;
	await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

	const routesMacroPath = `${frameworkRoot}/build/macros/routes.macro.ts`;
	const envMacroPath = `${frameworkRoot}/build/macros/env.macro.ts`;
	const manifestMacroPath = `${frameworkRoot}/build/macros/manifest.macro.ts`;
	const agentsHashMacroPath = `${frameworkRoot}/build/macros/agents-hash.macro.ts`;
	const agentsMacroPath = `${frameworkRoot}/build/macros/agents.macro.ts`;

	const serverEntrySource = generateServerEntry({
		appDir,
		entries,
		agents: agentMods,
		tools: toolMods,
		jobs: jobMods,
		hasUserMiddleware,
		frameworkRoot,
		routesMacroPath,
		envMacroPath,
		manifestMacroPath,
		agentsHashMacroPath,
		agentsMacroPath,
		manifestPath,
		target,
		port: options.port,
		compile,
	});
	const serverEntryPath = `${genDir}/server-entry.ts`;
	await Bun.write(serverEntryPath, serverEntrySource);

	// In compile mode the server entry imports ./embedded-manifest.ts; generate it
	// before the compile step so `with { type: "file" }` imports resolve. Client
	// chunks already exist on disk (the client build ran above); public assets are
	// enumerated without writing the dist/assets sidecar.
	if (compile) {
		const publicAssets = await copyAssets(appDir, outDir, { write: false });
		const chunkEntries = await collectClientChunks(clientOutDir);
		const embedded: EmbeddedEntry[] = [
			...publicAssets.map((a) => ({ url: a.publicPath, src: a.src })),
			...chunkEntries,
		];
		await Bun.write(
			`${genDir}/embedded-manifest.ts`,
			generateEmbeddedManifest(embedded),
		);
	}

	const adapter: Adapter = target === "edge" ? edgeAdapter : bunAdapter;

	// Server bundle is intentionally NOT minified: spec acceptance requires the
	// inlined route table to be grep-verifiable in the output, and minification
	// mangles property names on object literals.
	//
	// Compile mode skips this stage entirely: `bun build --compile` runs against
	// the source entry (see bunAdapter) so file/macro import attributes survive.
	let serverEntryOut: string | undefined;
	if (!compile) {
		const serverResult = await Bun.build({
			entrypoints: [serverEntryPath],
			target: adapter.buildTarget,
			outdir: serverOutDir,
			minify: false,
		});

		if (!serverResult.success) {
			const msgs = serverResult.logs
				.map((l) => l.message ?? String(l))
				.join("\n");
			throw new Error(`patties build: server bundle failed\n${msgs}`);
		}

		const serverOutput =
			serverResult.outputs.find((o) => o.kind === "entry-point") ??
			serverResult.outputs[0];
		serverEntryOut = serverOutput
			? serverOutput.path
			: `${serverOutDir}/server-entry.js`;
	}

	const assets = await copyAssets(appDir, outDir, { write: !compile });

	const emitted = await adapter.emit(
		{ serverEntryOut, serverEntrySrc: serverEntryPath, assets },
		{ appDir, outDir, mode, compile },
	);

	const result: BuildResult = {
		clientManifest: manifest,
		serverEntry: emitted.serverEntry,
		assets: emitted.assets,
		counts: {
			routes: entries.length,
			islands: islands.length,
			agents: agentMods.length,
			tools: toolMods.length,
			jobs: jobMods.length,
		},
		artifacts: emitted.extraFiles ?? [],
	};

	for (const p of plugins) {
		if (!p.hooks?.onBuildEnd) continue;
		try {
			await p.hooks.onBuildEnd(result);
		} catch (err) {
			throw wrapHookError(p.name, "onBuildEnd", err);
		}
	}

	return result;
}

function wrapHookError(name: string, hook: string, err: unknown): Error {
	const msg = (err as Error)?.message ?? String(err);
	const wrapped = new Error(`[plugin ${name}] ${hook}: ${msg}`);
	(wrapped as Error & { cause?: unknown }).cause = err;
	return wrapped;
}

function populateClientManifest(
	manifest: ClientManifest,
	outputs: Array<{ path: string; kind: string }>,
	clientEntryPath: string,
	islands: IslandEntry[],
	clientOutDir: string,
): void {
	for (const out of outputs) {
		if (out.kind === "entry-point") {
			manifest.entry = toPublicUrl(out.path, clientOutDir);
		}
	}

	// Map island source paths to chunk URLs by inspecting output filenames.
	// `splitting: true` emits chunks named after the source's basename plus hash.
	// We match by basename.
	const remainingIslands = new Map<string, IslandEntry>();
	for (const i of islands) {
		const base = i.relPath.replace(/\.[tj]sx?$/, "");
		remainingIslands.set(base.split("/").pop() ?? base, i);
	}

	for (const out of outputs) {
		if (out.kind === "entry-point") continue;
		const fname = out.path.split("/").pop() ?? "";
		const stem = fname.replace(/-[A-Za-z0-9]+\.(js|mjs)$/, "");
		const island = remainingIslands.get(stem);
		if (island) {
			manifest.islands[island.name] = toPublicUrl(out.path, clientOutDir);
		}
	}

	// For any islands we couldn't disambiguate via filename, fall back to the
	// entry chunk so hydration still has *something* to load. (Splitting may
	// inline a small island directly into the entry, in which case there's no
	// separate chunk to surface.)
	for (const i of islands) {
		if (!manifest.islands[i.name] && manifest.entry) {
			manifest.islands[i.name] = manifest.entry;
		}
	}

	// Reference unused vars to satisfy strict noUnusedParameters.
	void clientEntryPath;
}

function toPublicUrl(absPath: string, clientOutDir: string): string {
	const rel = absPath.startsWith(clientOutDir)
		? absPath.slice(clientOutDir.length)
		: `/${absPath.split("/").pop() ?? ""}`;
	return PUBLIC_PREFIX + rel.replace(/^\/+/, "");
}

function absolutize(p: string): string {
	if (p.startsWith("/")) return p.replace(/\/+$/, "");
	return (
		process.cwd().replace(/\/+$/, "") +
		"/" +
		p.replace(/^\.\//, "").replace(/\/+$/, "")
	);
}

function resolveFrameworkRoot(): string {
	// import.meta.dir is set by Bun for ES modules — points at src/build/.
	const here = import.meta.dir;
	return here.replace(/\/build\/?$/, "");
}
