// The cache key — the single correctness-critical artifact of `patties run`
// (framework/27-task-runner-cache). `key = sha256(canonical-serialize[…])` over
// nine components, conservative by design: over-invalidate before ever risking a
// stale hit. A dedicated sha256 is used here (NOT the truncated xxh64 in
// build/hash.ts, which is a fast non-crypto asset hash) — cache soundness needs
// a full cryptographic digest.

import { join } from "node:path";
import type { TaskConfig } from "../../config/schema.ts";
import type { FileHashes } from "./files.ts";
import type { PackageNode } from "./workspace.ts";

// Bump to invalidate every cache entry when the keying logic itself changes.
export const CACHE_FORMAT_VERSION = 1;

export function sha256Hex(bytes: Uint8Array | string): string {
	return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

/** Deterministic JSON: object keys sorted recursively; array order preserved. */
export function canonicalSerialize(value: unknown): string {
	return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortDeep);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort())
			out[key] = sortDeep((value as Record<string, unknown>)[key]);
		return out;
	}
	return value;
}

export interface KeyGlobals {
	root: string;
	/** Repo file fingerprints, root-relative POSIX path → hash. */
	fileHashes: FileHashes;
	/** Content hash of the root `patties.config.*` (or "" when absent). */
	rootConfigHash: string;
	/** Content hash of the root `tsconfig.json` (or "" when absent). */
	rootTsconfigHash: string;
	/** Content hash of the whole `bun.lock` (or "" when absent). Conservative:
	 * any dependency change anywhere rekeys — sound, refine to closure later. */
	bunLockHash: string;
	pattiesVersion: string;
	env: Record<string, string | undefined>;
}

export interface KeyComponents {
	cacheFormatVersion: number;
	task: { name: string; command: string };
	inputsHash: string;
	externalDeps: { lockHash: string; direct: Record<string, string> };
	internalDepKeys: Record<string, string>;
	globalInputs: {
		rootConfig: string;
		rootTsconfig: string;
		packageJson: string;
	};
	envValues: Record<string, string>;
	toolVersions: { bun: string; patties: string };
	platform: { platform: string; arch: string };
}

const INTERNAL_DEP_FIELDS = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
] as const;

export interface ComputeKeyInput {
	pkg: PackageNode;
	taskName: string;
	command: string;
	task: TaskConfig | undefined;
	globals: KeyGlobals;
	internalDepKeys: Record<string, string>;
}

export async function computeKey(
	input: ComputeKeyInput,
): Promise<{ key: string; components: KeyComponents }> {
	const { pkg, taskName, command, task, globals, internalDepKeys } = input;
	const outputs = task?.outputs ?? [];
	const outputGlobs = outputs.map((g) => new Bun.Glob(g));
	const inputGlobs = task?.inputs?.map((g) => new Bun.Glob(g));

	const prefix = pkg.relDir === "" ? "" : `${pkg.relDir}/`;
	const inputPairs: Array<[string, string]> = [];
	for (const [rootRel, hash] of globals.fileHashes) {
		if (prefix !== "" && !rootRel.startsWith(prefix)) continue;
		const pkgRel = prefix === "" ? rootRel : rootRel.slice(prefix.length);
		if (pkgRel === "") continue;
		if (outputGlobs.some((g) => g.match(pkgRel))) continue;
		if (inputGlobs && !inputGlobs.some((g) => g.match(pkgRel))) continue;
		inputPairs.push([pkgRel, hash]);
	}
	inputPairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
	const inputsHash = sha256Hex(canonicalSerialize(inputPairs));

	const components: KeyComponents = {
		cacheFormatVersion: CACHE_FORMAT_VERSION,
		task: { name: taskName, command },
		inputsHash,
		externalDeps: {
			lockHash: globals.bunLockHash,
			direct: directExternalDeps(pkg),
		},
		internalDepKeys,
		globalInputs: {
			rootConfig: globals.rootConfigHash,
			rootTsconfig: globals.rootTsconfigHash,
			packageJson: await packageJsonHash(pkg, globals),
		},
		envValues: resolveEnvValues(task?.env ?? [], globals.env),
		toolVersions: { bun: Bun.version, patties: globals.pattiesVersion },
		platform: { platform: process.platform, arch: process.arch },
	};

	return { key: sha256Hex(canonicalSerialize(components)), components };
}

function directExternalDeps(pkg: PackageNode): Record<string, string> {
	const internal = new Set(pkg.internalDeps);
	const out: Record<string, string> = {};
	for (const field of INTERNAL_DEP_FIELDS) {
		const deps = pkg.pkgJson[field];
		if (!deps) continue;
		for (const [name, spec] of Object.entries(deps))
			if (!internal.has(name)) out[name] = spec;
	}
	return out;
}

async function packageJsonHash(
	pkg: PackageNode,
	globals: KeyGlobals,
): Promise<string> {
	const rel = pkg.relDir === "" ? "package.json" : `${pkg.relDir}/package.json`;
	const tracked = globals.fileHashes.get(rel);
	if (tracked) return tracked;
	return sha256Hex(await Bun.file(join(globals.root, rel)).bytes());
}

function resolveEnvValues(
	patterns: string[],
	env: Record<string, string | undefined>,
): Record<string, string> {
	if (patterns.length === 0) return {};
	const globs = patterns.map((p) => new Bun.Glob(p));
	const out: Record<string, string> = {};
	for (const [name, value] of Object.entries(env)) {
		if (value === undefined) continue;
		if (globs.some((g) => g.match(name))) out[name] = value;
	}
	return out;
}

/**
 * Compare two component sets and name the first that differs — powers the
 * `--dry-run` "why did the key change" output. Returns null when identical.
 */
export function firstDifferingComponent(
	current: KeyComponents,
	previous: KeyComponents,
): keyof KeyComponents | null {
	for (const field of Object.keys(current) as Array<keyof KeyComponents>) {
		if (
			canonicalSerialize(current[field]) !== canonicalSerialize(previous[field])
		)
			return field;
	}
	return null;
}
