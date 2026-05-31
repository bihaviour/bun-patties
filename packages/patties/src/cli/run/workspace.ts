// Bun-workspace discovery + dependency graph for `patties run`
// (framework/27-task-runner-cache). Reads the root `package.json` `workspaces`
// globs, enumerates member `package.json`s with `Bun.Glob`, and builds the
// internal dependency graph (a dep is "internal" when its name matches a
// discovered workspace package), its reverse graph (dependents), a topological
// order, and a path→owning-package mapping. `bun --filter` owns *execution*
// order at the CLI; we replicate the same ordering here because the cache key
// must fold each dependency's key into its dependents' (see cache-key.ts).

import { join, relative } from "node:path";

export interface PackageJson {
	name?: string;
	version?: string;
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
}

export interface PackageNode {
	name: string;
	/** Absolute package directory. */
	dir: string;
	/** Package directory relative to the workspace root, POSIX-separated. */
	relDir: string;
	pkgJson: PackageJson;
	scripts: Record<string, string>;
	/** Names of workspace-internal dependencies (subset of discovered packages). */
	internalDeps: string[];
}

export interface Workspace {
	/** Absolute workspace root (where the root `package.json` lives). */
	root: string;
	/** Discovered packages, keyed by package name. */
	packages: Map<string, PackageNode>;
	/** Reverse edges: package name → set of packages that depend on it. */
	dependents: Map<string, Set<string>>;
	/** Topological order (dependencies before dependents). */
	topoOrder: string[];
	/**
	 * Map a repo-root-relative POSIX path to the owning package name, or `null`
	 * when the path is outside every package directory (a root-level change,
	 * which the affected-detection layer treats as "affects all").
	 */
	fileToPackage(relPath: string): string | null;
}

function toPosix(p: string): string {
	return p.split("\\").join("/");
}

/** Read the `workspaces` globs from a root `package.json` (array or object form). */
function workspaceGlobs(pkg: unknown): string[] {
	const ws = (pkg as { workspaces?: unknown }).workspaces;
	if (Array.isArray(ws))
		return ws.filter((x): x is string => typeof x === "string");
	if (ws && typeof ws === "object") {
		const packages = (ws as { packages?: unknown }).packages;
		if (Array.isArray(packages))
			return packages.filter((x): x is string => typeof x === "string");
	}
	return [];
}

function collectDepNames(pkg: PackageJson): string[] {
	return [
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.devDependencies ?? {}),
		...Object.keys(pkg.peerDependencies ?? {}),
		...Object.keys(pkg.optionalDependencies ?? {}),
	];
}

/**
 * Discover the Bun workspace rooted at `root`. Throws on a dependency cycle
 * (Bun would refuse to order it too) or when the root declares no workspaces.
 */
export async function discoverWorkspace(root: string): Promise<Workspace> {
	const rootPkgFile = Bun.file(join(root, "package.json"));
	if (!(await rootPkgFile.exists()))
		throw new Error(`patties run: no package.json at workspace root ${root}`);
	const rootPkg = (await rootPkgFile.json()) as unknown;

	const globs = workspaceGlobs(rootPkg);
	if (globs.length === 0)
		throw new Error(
			"patties run requires a Bun-workspace monorepo (no `workspaces` field in the root package.json).",
		);

	const packages = new Map<string, PackageNode>();
	for (const pattern of globs) {
		const glob = new Bun.Glob(`${pattern}/package.json`);
		for await (const rel of glob.scan({ cwd: root, onlyFiles: true })) {
			if (rel.includes("node_modules/")) continue;
			const file = Bun.file(join(root, rel));
			const pkgJson = (await file.json()) as PackageJson;
			if (!pkgJson.name) continue;
			const dir = join(root, rel.slice(0, rel.length - "/package.json".length));
			packages.set(pkgJson.name, {
				name: pkgJson.name,
				dir,
				relDir: toPosix(relative(root, dir)),
				pkgJson,
				scripts: pkgJson.scripts ?? {},
				internalDeps: [],
			});
		}
	}

	if (packages.size === 0)
		throw new Error(
			`patties run: the root \`workspaces\` globs matched no packages (${globs.join(", ")}).`,
		);

	const names = new Set(packages.keys());
	const dependents = new Map<string, Set<string>>();
	for (const name of names) dependents.set(name, new Set());

	for (const pkg of packages.values()) {
		const internal = collectDepNames(pkg.pkgJson).filter(
			(d) => names.has(d) && d !== pkg.name,
		);
		// De-dup (a name can appear in both deps and devDeps).
		pkg.internalDeps = [...new Set(internal)];
		for (const dep of pkg.internalDeps) dependents.get(dep)?.add(pkg.name);
	}

	return {
		root,
		packages,
		dependents,
		topoOrder: toposort(packages),
		fileToPackage: (relPath) => owningPackage(packages, relPath),
	};
}

/** Kahn's algorithm; dependencies emitted before the packages that need them. */
function toposort(packages: Map<string, PackageNode>): string[] {
	const indegree = new Map<string, number>();
	for (const name of packages.keys()) indegree.set(name, 0);
	for (const pkg of packages.values())
		indegree.set(pkg.name, pkg.internalDeps.length);

	// Stable ordering: process ready nodes in name order for deterministic keys.
	const ready = [...indegree.entries()]
		.filter(([, d]) => d === 0)
		.map(([n]) => n)
		.sort();
	const order: string[] = [];
	while (ready.length > 0) {
		const name = ready.shift() as string;
		order.push(name);
		const dependents = [...dependentsOf(packages, name)].sort();
		for (const dep of dependents) {
			const next = (indegree.get(dep) ?? 0) - 1;
			indegree.set(dep, next);
			if (next === 0) ready.push(dep);
		}
		ready.sort();
	}

	if (order.length !== packages.size) {
		const cyclic = [...packages.keys()].filter((n) => !order.includes(n));
		throw new Error(
			`patties run: workspace dependency cycle among: ${cyclic.sort().join(", ")}`,
		);
	}
	return order;
}

function dependentsOf(
	packages: Map<string, PackageNode>,
	name: string,
): string[] {
	const out: string[] = [];
	for (const pkg of packages.values())
		if (pkg.internalDeps.includes(name)) out.push(pkg.name);
	return out;
}

function owningPackage(
	packages: Map<string, PackageNode>,
	relPath: string,
): string | null {
	const p = toPosix(relPath);
	let best: { name: string; len: number } | null = null;
	for (const pkg of packages.values()) {
		const prefix = pkg.relDir === "" ? "" : `${pkg.relDir}/`;
		if (
			prefix !== "" &&
			p.startsWith(prefix) &&
			pkg.relDir.length > (best?.len ?? -1)
		)
			best = { name: pkg.name, len: pkg.relDir.length };
	}
	return best?.name ?? null;
}

/** Transitive dependents of `seed` packages, including the seeds themselves. */
export function dependentsClosure(
	ws: Workspace,
	seed: Iterable<string>,
): Set<string> {
	const result = new Set<string>();
	const stack = [...seed];
	while (stack.length > 0) {
		const name = stack.pop() as string;
		if (result.has(name)) continue;
		result.add(name);
		for (const dep of ws.dependents.get(name) ?? []) stack.push(dep);
	}
	return result;
}
