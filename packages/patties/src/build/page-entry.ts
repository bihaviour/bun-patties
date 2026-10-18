import type { BunPlugin } from "bun";
import type { RouteEntry } from "../types.ts";

export type HydrateDefault = "off" | "pages";

export interface HydratedPage {
	entry: RouteEntry;
	// Stable per-build id; also the generated entry's file stem.
	id: string;
	hasDeserialize: boolean;
}

// Server-only page exports. Removed from the client bundle so their imports
// (databases, secrets, `bun:*` modules) never reach the browser.
const SERVER_ONLY_EXPORTS = ["loader", "serialize"];

const HYDRATE_LITERAL_RE =
	/export\s+const\s+hydrate\s*(?::\s*boolean\s*)?=\s*(true|false)\b/;
const BARE_IMPORT_RE = /^\s*import\s*["']([^"']+)["'];?\s*$/gm;

function loaderFor(path: string): "tsx" | "ts" | "jsx" | "js" {
	if (path.endsWith(".tsx")) return "tsx";
	if (path.endsWith(".ts")) return "ts";
	if (path.endsWith(".jsx")) return "jsx";
	return "js";
}

// Decide statically (no module evaluation) whether a page route hydrates. A
// non-literal `hydrate` export is rejected: the build can't know its value
// without running user code.
export function readHydrateFlag(
	source: string,
	filePath: string,
	defaultMode: HydrateDefault,
): { hydrate: boolean; exports: string[] } {
	const exports = new Bun.Transpiler({ loader: loaderFor(filePath) }).scan(
		source,
	).exports;
	if (!exports.includes("hydrate")) {
		return { hydrate: defaultMode === "pages", exports };
	}
	const m = source.match(HYDRATE_LITERAL_RE);
	if (!m) {
		throw new Error(
			`patties build: ${filePath} exports \`hydrate\` but not as a literal boolean. Use \`export const hydrate = true\` (or false).`,
		);
	}
	return { hydrate: m[1] === "true", exports };
}

export async function scanHydratedPages(
	entries: RouteEntry[],
	defaultMode: HydrateDefault,
): Promise<HydratedPage[]> {
	const out: HydratedPage[] = [];
	for (const entry of entries) {
		if (entry.kind !== "page") continue;
		const source = await Bun.file(entry.filePath).text();
		const { hydrate, exports } = readHydrateFlag(
			source,
			entry.filePath,
			defaultMode,
		);
		if (!hydrate) continue;
		out.push({
			entry,
			id: `page-${out.length}-${slug(entry.bunPattern)}`,
			hasDeserialize: exports.includes("deserialize"),
		});
	}
	return out;
}

function slug(pattern: string): string {
	const s = pattern
		.replace(/[^A-Za-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return s || "index";
}

export function generatePageEntry(
	page: HydratedPage,
	options: { frameworkRoot: string },
): string {
	const runtime = JSON.stringify(`${options.frameworkRoot}/client/page.ts`);
	const pagePath = JSON.stringify(page.entry.filePath);
	const named = page.hasDeserialize ? ", { deserialize }" : "";
	const exportsObj = page.hasDeserialize ? "{ Page, deserialize }" : "{ Page }";
	return `import { bootPage } from ${runtime}
import Page${named} from ${pagePath}

bootPage(${JSON.stringify(page.entry.bunPattern)}, ${exportsObj})
`;
}

// Strip server-only exports from hydrated page modules before Bun.build sees
// them. `Bun.Transpiler` eliminates the exports and trims the imports only
// they used; trimmed imports survive as bare `import "x"` side-effect lines,
// which are dropped unless the author wrote them that way.
export function stripServerExportsPlugin(pagePaths: string[]): BunPlugin {
	const targets = new Set(pagePaths);
	return {
		name: "patties:strip-server-exports",
		setup(builder) {
			builder.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
				if (!targets.has(args.path)) return undefined;
				const source = await Bun.file(args.path).text();
				return {
					contents: stripServerExports(source, args.path),
					loader: "js",
				};
			});
		},
	};
}

export function stripServerExports(source: string, filePath: string): string {
	const authoredBare = new Set<string>();
	for (const m of source.matchAll(BARE_IMPORT_RE)) {
		if (m[1]) authoredBare.add(m[1]);
	}
	const transpiler = new Bun.Transpiler({
		loader: loaderFor(filePath),
		exports: { eliminate: SERVER_ONLY_EXPORTS },
		trimUnusedImports: true,
		autoImportJSX: true,
		// `react/jsx-runtime` exists in React's dev and prod builds alike, unlike
		// `jsxDEV`, so the stripped module works whichever one Bun.build resolves.
		define: { "process.env.NODE_ENV": '"production"' },
	});
	const out = transpiler.transformSync(source);
	return out.replace(BARE_IMPORT_RE, (line, spec: string) =>
		authoredBare.has(spec) ? line : "",
	);
}
