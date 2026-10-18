import { build, type ClientManifest } from "../build/index.ts";
import type { HydrateDefault } from "../build/page-entry.ts";
import { loadConfig } from "../config/load.ts";
import type { BunRoutes } from "../types.ts";

export interface SetupDevClientOptions {
	appDir: string;
	/** Where to emit the dev client bundle. Defaults to `<appDir>/.patties`. */
	outDir?: string;
	/** Whole-tree hydration default. Defaults to `render.hydrate` from config. */
	hydrate?: HydrateDefault;
}

export interface DevClient {
	manifest: ClientManifest;
	routes: BunRoutes;
	/** Re-runs the island bundle and mutates `manifest` in place. */
	rebuild(): Promise<void>;
}

const PUBLIC_PREFIX = "/_patties/client/";

// Bundles islands in development (no minify) and serves the chunks under
// `/_patties/client/*`. The returned `manifest` is what `createRenderer`
// needs to emit a `<script>` tag that hydrates the islands in the browser —
// without it, dev pages SSR fine but never wake up client-side.
export async function setupDevClient(
	options: SetupDevClientOptions,
): Promise<DevClient> {
	const appDir = options.appDir.replace(/\/+$/, "");
	const outDir = (options.outDir ?? `${appDir}/.patties`).replace(/\/+$/, "");
	const clientOutDir = `${outDir}/client`;

	const manifest: ClientManifest = { entry: null, islands: {}, pages: {} };
	const hydrate = options.hydrate ?? (await configuredHydrate());

	const rebuild = async (): Promise<void> => {
		const result = await build({
			appDir,
			outDir,
			mode: "development",
			hydrate,
		});
		manifest.entry = result.clientManifest.entry;
		// Replace keys so removed islands/pages disappear from the manifest.
		replaceRecord(manifest.islands, result.clientManifest.islands);
		replaceRecord(manifest.pages, result.clientManifest.pages);
	};

	await rebuild();

	const serveFile = async (req: Request): Promise<Response> => {
		const url = new URL(req.url);
		const rel = url.pathname.slice(PUBLIC_PREFIX.length).replace(/^\/+/, "");
		if (!rel || rel.includes("..")) {
			return new Response("not found", { status: 404 });
		}
		const file = Bun.file(`${clientOutDir}/${rel}`);
		if (!(await file.exists())) {
			return new Response("not found", { status: 404 });
		}
		const ctype =
			rel.endsWith(".js") || rel.endsWith(".mjs")
				? "application/javascript; charset=utf-8"
				: rel.endsWith(".css")
					? "text/css; charset=utf-8"
					: rel.endsWith(".map")
						? "application/json; charset=utf-8"
						: "application/octet-stream";
		return new Response(file, { headers: { "Content-Type": ctype } });
	};

	const routes: BunRoutes = {
		[`${PUBLIC_PREFIX}*`]: serveFile as unknown as BunRoutes[string],
	};

	return { manifest, routes, rebuild };
}

function replaceRecord(
	target: Record<string, string>,
	next: Record<string, string>,
): void {
	for (const k of Object.keys(target)) delete target[k];
	Object.assign(target, next);
}

// `patties dev` runs from the project root, so the config there is the app's.
// A missing or invalid config falls back to "off" — the dev client must boot.
async function configuredHydrate(): Promise<HydrateDefault> {
	try {
		const { config } = await loadConfig(process.cwd());
		return config.render.hydrate;
	} catch {
		return "off";
	}
}
