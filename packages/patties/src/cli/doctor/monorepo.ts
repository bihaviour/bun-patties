// Group D — monorepo invariants. Runs only when the root package.json declares
// `workspaces`; single-package projects skip the whole group. Reuses the
// return-based `assertSingleReact` from dev.ts (framework/26) for the
// single-React invariant.

import { join } from "node:path";
import { assertSingleReact } from "../dev.ts";
import type { Finding } from "./types.ts";

interface RootPkg {
	workspaces?: unknown;
	catalog?: Record<string, string>;
	catalogs?: Record<string, Record<string, string>>;
}

interface MemberPkg {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
}

/** `workspaces` globs from the root package.json (array or `{ packages }` form). */
function workspaceGlobs(pkg: RootPkg): string[] {
	const ws = pkg.workspaces;
	if (Array.isArray(ws))
		return ws.filter((x): x is string => typeof x === "string");
	if (ws && typeof ws === "object") {
		const packages = (ws as { packages?: unknown }).packages;
		if (Array.isArray(packages))
			return packages.filter((x): x is string => typeof x === "string");
	}
	return [];
}

async function readJson<T>(path: string): Promise<T | null> {
	try {
		return (await Bun.file(path).json()) as T;
	} catch {
		return null;
	}
}

/** Scan one workspace glob to its member package.json paths (skipping node_modules). */
async function globMembers(root: string, pattern: string): Promise<string[]> {
	const out: string[] = [];
	const glob = new Bun.Glob(`${pattern}/package.json`);
	for await (const rel of glob.scan({ cwd: root, onlyFiles: true })) {
		if (rel.includes("node_modules/")) continue;
		out.push(rel);
	}
	return out;
}

function allDeps(pkg: MemberPkg): Record<string, string> {
	return {
		...pkg.dependencies,
		...pkg.devDependencies,
		...pkg.peerDependencies,
		...pkg.optionalDependencies,
	};
}

export async function checkMonorepo(
	root: string,
	appDir: string,
	frameworkDir: string,
): Promise<Finding[]> {
	const rootPkg = await readJson<RootPkg>(join(root, "package.json"));
	const globs = rootPkg ? workspaceGlobs(rootPkg) : [];
	if (globs.length === 0) return []; // single-package project: group absent

	const out: Finding[] = [];

	// D.9 — every glob must resolve to at least one package.
	const memberRels: string[] = [];
	const emptyGlobs: string[] = [];
	for (const pattern of globs) {
		const members = await globMembers(root, pattern);
		if (members.length === 0) emptyGlobs.push(pattern);
		else memberRels.push(...members);
	}
	out.push(
		emptyGlobs.length > 0
			? {
					id: "workspace-globs",
					group: "Monorepo",
					status: "fail",
					detail: `workspace glob matched no package: ${emptyGlobs.join(", ")}`,
					remedy:
						"fix the `workspaces` globs in package.json or add the package",
				}
			: {
					id: "workspace-globs",
					group: "Monorepo",
					status: "pass",
					detail: "workspace globs resolve",
				},
	);

	// D.10 — exactly one copy of react/react-dom across the hoisted tree.
	const react = assertSingleReact(root, appDir, frameworkDir);
	out.push(
		react.ok
			? {
					id: "single-react",
					group: "Monorepo",
					status: "pass",
					detail: "single React copy",
				}
			: {
					id: "single-react",
					group: "Monorepo",
					status: "fail",
					detail:
						react.message.split("\n")[0]?.replace(/^✗\s*/, "") ??
						"duplicate React",
					remedy: "align the react version, then `bun install`",
				},
	);

	// D.11 — every `catalog:` reference resolves to a root catalog entry.
	const defaultCatalog = rootPkg?.catalog ?? {};
	const namedCatalogs = rootPkg?.catalogs ?? {};
	const dangling: string[] = [];
	for (const rel of memberRels) {
		const member = await readJson<MemberPkg>(join(root, rel));
		if (!member) continue;
		for (const [dep, range] of Object.entries(allDeps(member))) {
			if (!range.startsWith("catalog:")) continue;
			const name = range.slice("catalog:".length);
			const catalog = name === "" ? defaultCatalog : namedCatalogs[name];
			if (!catalog || !(dep in catalog)) {
				dangling.push(`${member.name ?? rel}:${dep} (${range})`);
			}
		}
	}
	out.push(
		dangling.length > 0
			? {
					id: "catalog-refs",
					group: "Monorepo",
					status: "fail",
					detail: `dangling catalog reference: ${dangling.slice(0, 3).join(", ")}`,
					remedy:
						"add the entry to the root `catalog` / `catalogs` in package.json",
				}
			: {
					id: "catalog-refs",
					group: "Monorepo",
					status: "pass",
					detail: "catalog references resolve",
				},
	);

	return out;
}
