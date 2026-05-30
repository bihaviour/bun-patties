// Build-time generator for the embedded-files manifest used by single-binary
// (`bun build --compile`) deploys. Each entry becomes a `with { type: "file" }`
// import so Bun embeds the bytes into the binary; at runtime the server entry
// resolves them via `Bun.embeddedFiles`. Enumeration happens here, at build
// time — the binary never globs `app/public` (build-time-discovery rule).
//
// URL convention follows patties' actual scheme — public assets at
// `/_patties/assets/<rel>`, client chunks at `/_patties/client/<file>` — not
// the spec's illustrative `/favicon.ico`.

const CLIENT_PREFIX = "/_patties/client/";

export interface EmbeddedEntry {
	/** Public URL the embedded file is served at. */
	url: string;
	/** Absolute path used as the `with { type: "file" }` import source. */
	src: string;
}

/**
 * Enumerate every file in the built client output dir. All client chunks
 * (js / css / maps) are embedded so the compiled binary serves them with no
 * `dist/client` sidecar. Returns [] when the dir is absent (zero-island app).
 */
export async function collectClientChunks(
	clientOutDir: string,
): Promise<EmbeddedEntry[]> {
	const glob = new Bun.Glob("**/*");
	const out: EmbeddedEntry[] = [];
	try {
		for await (const rel of glob.scan({ cwd: clientOutDir, onlyFiles: true })) {
			out.push({
				url: `${CLIENT_PREFIX}${rel}`,
				src: `${clientOutDir}/${rel}`,
			});
		}
	} catch (err) {
		const msg = (err as Error)?.message ?? "";
		if (/ENOENT|no such file/i.test(msg)) return [];
		throw err;
	}
	return out;
}

/**
 * Emit the source for `<genDir>/embedded-manifest.ts`. Each entry becomes a
 * `with { type: "file" }` import; `EMBEDDED_ASSET_PATHS` maps the public URL to
 * the imported value (which equals the embedded file's Bun identity / `.name`).
 */
export function generateEmbeddedManifest(entries: EmbeddedEntry[]): string {
	const imports = entries
		.map(
			(e, i) =>
				`import a${i} from ${JSON.stringify(e.src)} with { type: "file" };`,
		)
		.join("\n");
	const mapEntries = entries
		.map((e, i) => `\t${JSON.stringify(e.url)}: a${i},`)
		.join("\n");
	return `${imports}

export const EMBEDDED_ASSET_PATHS: Record<string, string> = {
${mapEntries}
};
`;
}
