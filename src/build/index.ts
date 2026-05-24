import { bunAdapter } from "../adapters/bun.ts";
import { edgeAdapter } from "../adapters/edge.ts";
import type { Adapter } from "../adapters/types.ts";
import { scanAgents, scanJobs, scanTools } from "../ai/scan.ts";
import { scanRoutes } from "../router/filesystem.ts";
import { type BuiltAsset, copyAssets } from "./assets.ts";
import { generateClientEntry } from "./client-entry.ts";
import { type IslandEntry, scanIslands } from "./scan-islands.ts";
import { generateServerEntry } from "./server-entry.ts";

export type { BuiltAsset };

export interface ClientManifest {
	entry: string | null;
	islands: Record<string, string>;
}

export interface BuildResult {
	clientManifest: ClientManifest;
	serverEntry: string;
	assets: BuiltAsset[];
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
}

const PUBLIC_PREFIX = "/_patties/client/";

export async function build(options: BuildOptions): Promise<BuildResult> {
	const appDir = absolutize(options.appDir);
	const outDir = absolutize(options.outDir ?? ".patties");
	const target = options.target ?? "bun";
	const mode = options.mode ?? "production";

	// genDir lives under appDir so generated entries can resolve react/react-dom
	// via the normal upward node_modules walk. outDir holds only built artifacts.
	const genDir = appDir + "/patties-gen";
	const clientOutDir = outDir + "/client";
	const serverOutDir = outDir + "/server";

	const islands = await scanIslands(appDir);
	const entries = await scanRoutes(appDir);
	const agentMods = await scanAgents(appDir);
	const toolMods = await scanTools(appDir);
	const jobMods = await scanJobs(appDir);
	const hasUserMiddleware = await Bun.file(appDir + "/middleware.ts").exists();

	const manifest: ClientManifest = { entry: null, islands: {} };
	const frameworkRoot = resolveFrameworkRoot();

	if (islands.length > 0) {
		const clientEntryPath = genDir + "/client-entry.ts";
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
			throw new Error("patties build: client bundle failed\n" + msgs);
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
			genDir + "/client-entry.ts",
			generateClientEntry([], { frameworkRoot }),
		);
	}

	// Manifest must hit disk before the server entry is generated — the server
	// entry pulls it back in via the MANIFEST macro, which reads from this path
	// at bundle time.
	const manifestPath = outDir + "/manifest.json";
	await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

	const routesMacroPath = frameworkRoot + "/build/macros/routes.macro.ts";
	const envMacroPath = frameworkRoot + "/build/macros/env.macro.ts";
	const manifestMacroPath = frameworkRoot + "/build/macros/manifest.macro.ts";
	const agentsHashMacroPath =
		frameworkRoot + "/build/macros/agents-hash.macro.ts";
	const agentsMacroPath = frameworkRoot + "/build/macros/agents.macro.ts";

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
	});
	const serverEntryPath = genDir + "/server-entry.ts";
	await Bun.write(serverEntryPath, serverEntrySource);

	const adapter: Adapter = target === "edge" ? edgeAdapter : bunAdapter;

	// Server bundle is intentionally NOT minified: spec acceptance requires the
	// inlined route table to be grep-verifiable in the output, and minification
	// mangles property names on object literals.
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
		throw new Error("patties build: server bundle failed\n" + msgs);
	}

	const serverOutput =
		serverResult.outputs.find((o) => o.kind === "entry-point") ??
		serverResult.outputs[0];
	const serverEntryOut = serverOutput
		? serverOutput.path
		: serverOutDir + "/server-entry.js";

	const assets = await copyAssets(appDir, outDir);

	const emitted = await adapter.emit(
		{ serverEntryOut, assets },
		{ appDir, outDir, mode, compile: options.compile === true },
	);

	return {
		clientManifest: manifest,
		serverEntry: emitted.serverEntry,
		assets: emitted.assets,
	};
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
		remainingIslands.set(base.split("/").pop()!, i);
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
		: "/" + (absPath.split("/").pop() ?? "");
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
