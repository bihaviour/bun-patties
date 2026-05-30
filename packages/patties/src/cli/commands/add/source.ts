import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import type { ComponentEntry } from "patties-ui/types";
import { log } from "../../log.ts";
import type { Catalog } from "./load-catalog.ts";
import {
	type ComponentPayload,
	componentTarget,
	fetchPayload,
	RegistryError,
	readPayloadFile,
} from "./registry-fetch.ts";

// One resolved component ready for the stamp pipeline. `templatesDir` is the dir
// the existing stamper/internal/tokens/view code reads source from — the
// built-in catalog dir for catalog names, the file's own dir for a single local
// file, or a throwaway temp dir for materialized remote payloads.
export interface ResolvedSource {
	entry: ComponentEntry;
	templatesDir: string;
	fromCatalog: boolean;
	cleanup?: () => Promise<void>;
}

export interface ResolveOptions {
	catalog: Catalog;
	registries: Record<string, string>;
	cwd: string;
	allowInsecure: boolean;
	// Injectable for tests; forwarded to the registry fetch. Defaults to global.
	fetchImpl?: typeof fetch;
}

export type SourceKind =
	| { kind: "name"; name: string }
	| { kind: "namespaced"; ns: string; name: string }
	| { kind: "local"; path: string }
	| { kind: "url"; url: string };

// Classify an `add` positional. Order matters: URL, then namespaced (`@ns/x`),
// then path-like (prefix, embedded slash, or a source/payload extension),
// otherwise a built-in catalog name (cli/15).
export function classifySource(arg: string): SourceKind {
	if (/^https?:\/\//i.test(arg)) return { kind: "url", url: arg };
	if (arg.startsWith("@")) {
		const slash = arg.indexOf("/");
		if (slash > 0) {
			return {
				kind: "namespaced",
				ns: arg.slice(0, slash),
				name: arg.slice(slash + 1),
			};
		}
	}
	if (
		arg.startsWith("./") ||
		arg.startsWith("../") ||
		arg.startsWith("/") ||
		arg.includes("/") ||
		/\.(tsx?|jsx?|json)$/i.test(arg)
	) {
		return { kind: "local", path: arg };
	}
	return { kind: "name", name: arg };
}

async function materialize(
	payload: ComponentPayload,
): Promise<{ templatesDir: string; cleanup: () => Promise<void> }> {
	const dir = await mkdtemp(join(tmpdir(), "patties-reg-"));
	for (const [rel, contents] of Object.entries(payload.templates)) {
		await Bun.write(join(dir, rel), contents);
	}
	return {
		templatesDir: dir,
		cleanup: () => rm(dir, { recursive: true, force: true }),
	};
}

function synthLocalEntry(absPath: string, original: string): ComponentEntry {
	const base = basename(absPath);
	const name = base.replace(/\.(tsx|ts|jsx|js)$/i, "");
	return {
		name,
		spec: `local:${original}`,
		phase: 0,
		kind: "primitive",
		island: "no",
		status: "completed",
		files: [{ from: base, to: base }],
		peerDeps: {},
		internalHelpers: [],
	};
}

async function resolveLocal(
	path: string,
	cwd: string,
): Promise<ResolvedSource> {
	const abs = isAbsolute(path) ? path : resolve(cwd, path);
	if (/\.json$/i.test(abs)) {
		const payload = await readPayloadFile(abs);
		const mat = await materialize(payload);
		return {
			entry: payload.entry,
			templatesDir: mat.templatesDir,
			fromCatalog: false,
			cleanup: mat.cleanup,
		};
	}
	if (!(await Bun.file(abs).exists())) {
		throw new RegistryError(`file not found: ${path}`);
	}
	return {
		entry: synthLocalEntry(abs, path),
		templatesDir: dirname(abs),
		fromCatalog: false,
	};
}

async function resolveNamespaced(
	ns: string,
	name: string,
	opts: ResolveOptions,
): Promise<ResolvedSource> {
	const base = opts.registries[ns];
	if (!base) {
		throw new RegistryError(
			`no registry configured for namespace ${ns}; add it to config.ui.registries`,
		);
	}
	const payload = /^https?:\/\//i.test(base)
		? await fetchPayload(componentTarget(base, name), {
				allowInsecure: opts.allowInsecure,
				fetchImpl: opts.fetchImpl,
			})
		: await readPayloadFile(
				join(isAbsolute(base) ? base : resolve(opts.cwd, base), `${name}.json`),
			);
	const mat = await materialize(payload);
	return {
		entry: payload.entry,
		templatesDir: mat.templatesDir,
		fromCatalog: false,
		cleanup: mat.cleanup,
	};
}

async function resolveOne(
	arg: string,
	opts: ResolveOptions,
): Promise<ResolvedSource> {
	const kind = classifySource(arg);
	switch (kind.kind) {
		case "name": {
			const entry = opts.catalog.components.find((c) => c.name === kind.name);
			if (!entry) throw new RegistryError(`unknown component: ${kind.name}`);
			return {
				entry,
				templatesDir: opts.catalog.templatesDir,
				fromCatalog: true,
			};
		}
		case "namespaced":
			return resolveNamespaced(kind.ns, kind.name, opts);
		case "url": {
			const payload = await fetchPayload(kind.url, {
				allowInsecure: opts.allowInsecure,
				fetchImpl: opts.fetchImpl,
			});
			const mat = await materialize(payload);
			return {
				entry: payload.entry,
				templatesDir: mat.templatesDir,
				fromCatalog: false,
				cleanup: mat.cleanup,
			};
		}
		case "local":
			return resolveLocal(kind.path, opts.cwd);
	}
}

// Resolve every positional into a stampable source. On the first failure logs
// the reason, cleans up any temp dirs already materialized, and returns null so
// the caller exits without writing anything.
export async function resolveSources(
	args: string[],
	opts: ResolveOptions,
): Promise<ResolvedSource[] | null> {
	const out: ResolvedSource[] = [];
	for (const arg of args) {
		try {
			out.push(await resolveOne(arg, opts));
		} catch (err) {
			log.error(err instanceof Error ? err.message : String(err));
			await cleanupSources(out);
			return null;
		}
	}
	return out;
}

export async function cleanupSources(sources: ResolvedSource[]): Promise<void> {
	for (const s of sources) {
		if (s.cleanup) await s.cleanup();
	}
}
