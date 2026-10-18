import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import type { ComponentEntry } from "patties-ui/types";
import { log } from "../../log.ts";
import type { Catalog } from "./load-catalog.ts";
import {
	type ComponentPayload,
	componentTarget,
	fetchJson,
	parsePayload,
	RegistryError,
	readJsonFile,
} from "./registry-fetch.ts";
import {
	DEFAULT_REGISTRIES,
	isShadcnItem,
	mapShadcnItem,
	parseShadcnItem,
	pinDeps,
} from "./shadcn.ts";

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
	const root = resolve(dir);
	for (const [rel, contents] of Object.entries(payload.templates)) {
		// Defense-in-depth: the payload schema already rejects unsafe keys, but
		// never let a join escape the temp dir even if that boundary regresses.
		const dest = resolve(dir, rel);
		if (dest !== root && !dest.startsWith(root + sep)) {
			throw new RegistryError(`unsafe template path escapes temp dir: ${rel}`);
		}
		await Bun.write(dest, contents);
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

const isUrl = (s: string) => /^https?:\/\//i.test(s);

// Load one registry document (URL or local .json) into stampable sources. A
// patties payload yields itself; a shadcn registry item is mapped, its deps
// pinned, and its registryDependencies resolved first — depth-first, deduped
// by target via `seen` so shared deps (e.g. `button`) stamp once.
async function resolveRegistryTarget(
	target: string,
	opts: ResolveOptions,
	seen: Set<string>,
): Promise<ResolvedSource[]> {
	seen.add(target);
	const raw = isUrl(target)
		? await fetchJson(target, {
				allowInsecure: opts.allowInsecure,
				fetchImpl: opts.fetchImpl,
			})
		: await readJsonFile(target);
	if (!isShadcnItem(raw)) {
		return [await materializeSource(parsePayload(raw))];
	}
	const mapped = mapShadcnItem(parseShadcnItem(raw, target), target);
	mapped.payload.entry.peerDeps = await pinDeps(
		mapped.payload.entry.peerDeps,
		mapped.unpinned,
		opts.fetchImpl,
	);
	// Re-validate the mapped entry against ComponentEntrySchema before stamping.
	const payload = parsePayload(mapped.payload);
	const out: ResolvedSource[] = [];
	for (const dep of mapped.registryDeps) {
		const depTarget = registryDepTarget(dep, target, opts);
		if (seen.has(depTarget)) continue;
		out.push(...(await resolveRegistryTarget(depTarget, opts, seen)));
	}
	out.push(await materializeSource(payload));
	return out;
}

// A shadcn registryDependency is a URL, an `@ns/name` ref, or a bare name
// that lives next to the item that named it.
function registryDepTarget(
	dep: string,
	parent: string,
	opts: ResolveOptions,
): string {
	if (isUrl(dep)) return dep;
	const kind = classifySource(dep);
	if (kind.kind === "namespaced")
		return namespacedTarget(kind.ns, kind.name, opts);
	const dir = isUrl(parent) ? new URL(".", parent).href : `${dirname(parent)}/`;
	return isUrl(dir) ? componentTarget(dir, dep) : join(dir, `${dep}.json`);
}

async function materializeSource(
	payload: ComponentPayload,
): Promise<ResolvedSource> {
	const mat = await materialize(payload);
	return {
		entry: payload.entry,
		templatesDir: mat.templatesDir,
		fromCatalog: false,
		cleanup: mat.cleanup,
	};
}

async function resolveLocal(
	path: string,
	opts: ResolveOptions,
	seen: Set<string>,
): Promise<ResolvedSource[]> {
	const abs = isAbsolute(path) ? path : resolve(opts.cwd, path);
	if (/\.json$/i.test(abs)) return resolveRegistryTarget(abs, opts, seen);
	if (!(await Bun.file(abs).exists())) {
		throw new RegistryError(`file not found: ${path}`);
	}
	return [
		{
			entry: synthLocalEntry(abs, path),
			templatesDir: dirname(abs),
			fromCatalog: false,
		},
	];
}

function namespacedTarget(
	ns: string,
	name: string,
	opts: ResolveOptions,
): string {
	const base = opts.registries[ns] ?? DEFAULT_REGISTRIES[ns];
	if (!base) {
		throw new RegistryError(
			`no registry configured for namespace ${ns}; add it to config.ui.registries`,
		);
	}
	return isUrl(base)
		? componentTarget(base, name)
		: join(isAbsolute(base) ? base : resolve(opts.cwd, base), `${name}.json`);
}

async function resolveOne(
	arg: string,
	opts: ResolveOptions,
	seen: Set<string>,
): Promise<ResolvedSource[]> {
	const kind = classifySource(arg);
	switch (kind.kind) {
		case "name": {
			const entry = opts.catalog.components.find((c) => c.name === kind.name);
			if (!entry) throw new RegistryError(`unknown component: ${kind.name}`);
			return [
				{
					entry,
					templatesDir: opts.catalog.templatesDir,
					fromCatalog: true,
				},
			];
		}
		case "namespaced":
			return resolveRegistryTarget(
				namespacedTarget(kind.ns, kind.name, opts),
				opts,
				seen,
			);
		case "url":
			return resolveRegistryTarget(kind.url, opts, seen);
		case "local":
			return resolveLocal(kind.path, opts, seen);
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
	const seen = new Set<string>();
	for (const arg of args) {
		try {
			out.push(...(await resolveOne(arg, opts, seen)));
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
