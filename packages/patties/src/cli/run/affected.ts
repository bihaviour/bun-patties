// Affected detection for `patties run --affected` (framework/27-task-runner-cache).
// Diff the working tree against a base ref, map changed files to their owning
// workspace packages, then take the reverse-graph closure (a package + every
// package that transitively depends on it). This is an OPTIMIZATION layer: with
// the `internalDepKeys` term in the cache key, running the task across all
// packages is already correct — unchanged packages are cache hits. `--affected`
// merely skips even the hit lookups.

import { gitEnv } from "./git.ts";
import { dependentsClosure, type Workspace } from "./workspace.ts";

/** All affected package names, or "all" when the change set is repo-wide /
 * undeterminable (root-level change, or git unavailable). */
export type Affected = Set<string> | "all";

export interface AffectedOptions {
	since?: string;
}

const DEFAULT_BASE = "origin/main";

export async function computeAffected(
	ws: Workspace,
	opts: AffectedOptions = {},
): Promise<Affected> {
	const ref = opts.since ?? DEFAULT_BASE;

	const base = await mergeBase(ws.root, ref);
	if (base === null) return "all"; // shallow clone / detached / unknown ref

	const changed = await changedFiles(ws.root, base);
	if (changed === null) return "all";

	const seeds = new Set<string>();
	for (const file of changed) {
		const owner = ws.fileToPackage(file);
		if (owner === null) return "all"; // a root-level change touches everything
		seeds.add(owner);
	}
	return dependentsClosure(ws, seeds);
}

async function mergeBase(root: string, ref: string): Promise<string | null> {
	const res = await Bun.$`git merge-base ${ref} HEAD`
		.cwd(root)
		.env(gitEnv())
		.nothrow()
		.quiet();
	if (res.exitCode !== 0) return null;
	const sha = res.stdout.toString().trim();
	return sha === "" ? null : sha;
}

async function changedFiles(
	root: string,
	base: string,
): Promise<string[] | null> {
	const diff = await Bun.$`git diff --name-only ${base}...HEAD`
		.cwd(root)
		.env(gitEnv())
		.nothrow()
		.quiet();
	if (diff.exitCode !== 0) return null;

	// Include untracked-but-not-ignored files so a brand-new package/file counts.
	const untracked = await Bun.$`git ls-files --others --exclude-standard`
		.cwd(root)
		.env(gitEnv())
		.nothrow()
		.quiet();

	const files = new Set<string>();
	for (const line of diff.stdout.toString().split("\n"))
		if (line !== "") files.add(line);
	if (untracked.exitCode === 0)
		for (const line of untracked.stdout.toString().split("\n"))
			if (line !== "") files.add(line);
	return [...files];
}
