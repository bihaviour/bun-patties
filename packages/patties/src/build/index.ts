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
import {
	generatePageEntry,
	type HydrateDefault,
	type HydratedPage,
	scanHydratedPages,
	stripServerExportsPlugin,
} from "./page-entry.ts";
import { type IslandEntry, scanIslands } from "./scan-islands.ts";
import { generateServerEntry } from "./server-entry.ts";

export type { BuiltAsset };

export interface ClientManifest {
	entry: string | null;
	islands: Record<string, string>;
	// Whole-tree hydrated routes: bunPattern → page entry chunk URL.
	pages: Record<string, string>;
}

export interface BuildCounts {
	routes: number;
	islands: number;
	agents: number;
	tools: number;
	jobs: number;
	hydratedPages: number;
}

export interface BuildResult {
	clientManifest: ClientManifest;
	// Hydrated route → bytes of its entry chunk plus every chunk it statically
	// imports (what a cold visit downloads). Empty when no route hydrates.
	clientBytes: Record<string, number>;
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
	// `render.hydrate` from config: "pages" hydrates every route unless it
	// exports `hydrate = false`. Default "off".
	hydrate?: HydrateDefault;
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

	const manifest: ClientManifest = { entry: null, islands: {}, pages: {} };
	const frameworkRoot = resolveFrameworkRoot();
	const hydratedPages = await scanHydratedPages(
		entries,
		options.hydrate ?? "off",
	);
	let clientBytes: Record<string, number> = {};

	const clientEntryPath = `${genDir}/client-entry.ts`;
	await Bun.write(
		clientEntryPath,
		generateClientEntry(islands, { frameworkRoot }),
	);
	const pageEntryPaths = new Map<string, HydratedPage>();
	for (const page of hydratedPages) {
		const path = `${genDir}/${page.id}.ts`;
		await Bun.write(path, generatePageEntry(page, { frameworkRoot }));
		pageEntryPaths.set(path, page);
	}

	const entrypoints = [
		...(islands.length > 0 ? [clientEntryPath] : []),
		...pageEntryPaths.keys(),
	];

	// Zero-island, zero-hydrated-page project: write nothing to client/.
	if (entrypoints.length > 0) {
		// Under `bun test`, the process's first Bun.build that resolves several
		// absolute route paths can spuriously report "Could not resolve".
		// Resolving them once through the runtime resolver primes the shared cache.
		for (const file of [
			...islands.map((i) => i.filePath),
			...hydratedPages.map((p) => p.entry.filePath),
		]) {
			Bun.resolveSync(file, appDir);
		}
		// One build for islands + every page so React and shared components
		// land in common chunks instead of one copy per entry.
		const clientResult = await Bun.build({
			entrypoints,
			target: "browser",
			splitting: true,
			minify: mode === "production",
			outdir: clientOutDir,
			naming: "[name]-[hash].[ext]",
			// React picks its dev or prod build from NODE_ENV; without this the
			// browser bundle ships React's development build in production.
			define: { "process.env.NODE_ENV": JSON.stringify(mode) },
			plugins: [
				stripServerExportsPlugin(hydratedPages.map((p) => p.entry.filePath)),
			],
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
			islands,
			hydratedPages,
			clientOutDir,
		);
		clientBytes = await measurePageBytes(manifest.pages, clientOutDir);
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
		clientBytes,
		serverEntry: emitted.serverEntry,
		assets: emitted.assets,
		counts: {
			routes: entries.length,
			islands: islands.length,
			agents: agentMods.length,
			tools: toolMods.length,
			jobs: jobMods.length,
			hydratedPages: hydratedPages.length,
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
	islands: IslandEntry[],
	pages: HydratedPage[],
	clientOutDir: string,
): void {
	const pageById = new Map(pages.map((p) => [p.id, p]));
	for (const out of outputs) {
		if (out.kind !== "entry-point") continue;
		const stem = outputStem(out.path);
		const page = pageById.get(stem);
		if (page) {
			manifest.pages[page.entry.bunPattern] = toPublicUrl(
				out.path,
				clientOutDir,
			);
		} else if (stem === "client-entry") {
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
		const island = remainingIslands.get(outputStem(out.path));
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
}

function outputStem(path: string): string {
	const fname = path.split("/").pop() ?? "";
	return fname.replace(/-[A-Za-z0-9]+\.(js|mjs)$/, "");
}

const STATIC_IMPORT_RE =
	/(?:import|export)\s*(?:[^"'`;]*?from\s*)?["'](\.\/[^"']+)["']/g;

// Sum each hydrated route's entry chunk and its static import closure. Chunks
// shared with other routes (React) count toward every route that needs them.
async function measurePageBytes(
	pages: Record<string, string>,
	clientOutDir: string,
): Promise<Record<string, number>> {
	const sizes = new Map<string, { bytes: number; deps: string[] }>();
	const read = async (rel: string) => {
		const hit = sizes.get(rel);
		if (hit) return hit;
		const file = Bun.file(`${clientOutDir}/${rel}`);
		const text = (await file.exists()) ? await file.text() : "";
		const deps = [...text.matchAll(STATIC_IMPORT_RE)]
			.map((m) => (m[1] ?? "").slice(2))
			.filter(Boolean);
		const info = { bytes: new TextEncoder().encode(text).length, deps };
		sizes.set(rel, info);
		return info;
	};
	const out: Record<string, number> = {};
	for (const [route, url] of Object.entries(pages)) {
		const seen = new Set<string>();
		const queue = [url.slice(PUBLIC_PREFIX.length)];
		let total = 0;
		while (queue.length > 0) {
			const rel = queue.pop() as string;
			if (seen.has(rel)) continue;
			seen.add(rel);
			const info = await read(rel);
			total += info.bytes;
			queue.push(...info.deps);
		}
		out[route] = total;
	}
	return out;
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
