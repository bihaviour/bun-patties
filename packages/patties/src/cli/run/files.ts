// Repo-wide content fingerprints for the cache key (framework/27-task-runner-cache).
// Tracked files reuse the blob SHA git already computed (`git ls-files -s`) — no
// re-hashing — and untracked-but-not-ignored files are hashed with
// `Bun.CryptoHasher`. Using git's own file lists makes the default input set
// gitignore-aware for free (node_modules, dist, etc. are excluded). Outside a
// git repo we fall back to a filesystem scan.

import { join } from "node:path";
import { sha256Hex } from "./cache-key.ts";
import { gitEnv } from "./git.ts";

export type FileHashes = Map<string, string>;

async function gitOk(root: string): Promise<boolean> {
	const res = await Bun.$`git rev-parse --is-inside-work-tree`
		.cwd(root)
		.env(gitEnv())
		.nothrow()
		.quiet();
	return res.exitCode === 0;
}

/**
 * Map every repo file (root-relative, POSIX) to a content fingerprint. Tracked
 * files → git blob SHA; untracked non-ignored files → sha256 of their bytes.
 */
export async function collectRepoFileHashes(root: string): Promise<FileHashes> {
	const hashes: FileHashes = new Map();
	if (!(await gitOk(root))) return scanFilesystem(root, hashes);

	// `git ls-files -s` → "<mode> <blobSHA> <stage>\t<path>". The blob SHA is the
	// INDEX content, which is the fast path only for files unmodified in the
	// working tree — we overlay disk content for modified/deleted ones below.
	const tracked = await Bun.$`git ls-files -s`
		.cwd(root)
		.env(gitEnv())
		.nothrow()
		.quiet()
		.text();
	for (const line of tracked.split("\n")) {
		if (line === "") continue;
		const tab = line.indexOf("\t");
		if (tab === -1) continue;
		const meta = line.slice(0, tab).split(/\s+/);
		const sha = meta[1];
		const path = line.slice(tab + 1);
		if (sha) hashes.set(path, sha);
	}

	// Overlay the working tree: a tracked file edited but not staged keeps a
	// stale index blob SHA, so re-hash modified files from disk and drop deleted
	// ones. Without this an uncommitted edit would be a silent stale cache hit.
	const modified = await Bun.$`git diff --name-only`
		.cwd(root)
		.env(gitEnv())
		.nothrow()
		.quiet()
		.text();
	for (const path of modified.split("\n")) {
		if (path === "") continue;
		const abs = join(root, path);
		if (await Bun.file(abs).exists()) hashes.set(path, await hashFile(abs));
		else hashes.delete(path);
	}

	// Untracked, not gitignored.
	const others = await Bun.$`git ls-files --others --exclude-standard`
		.cwd(root)
		.env(gitEnv())
		.nothrow()
		.quiet()
		.text();
	for (const path of others.split("\n")) {
		if (path === "") continue;
		hashes.set(path, await hashFile(join(root, path)));
	}

	return hashes;
}

async function scanFilesystem(
	root: string,
	hashes: FileHashes,
): Promise<FileHashes> {
	const glob = new Bun.Glob("**/*");
	for await (const rel of glob.scan({ cwd: root, onlyFiles: true })) {
		if (rel.includes("node_modules/") || rel.startsWith(".git/")) continue;
		if (rel.includes("/.patties/") || rel.startsWith(".patties/")) continue;
		hashes.set(rel.split("\\").join("/"), await hashFile(join(root, rel)));
	}
	return hashes;
}

async function hashFile(abs: string): Promise<string> {
	return sha256Hex(await Bun.file(abs).bytes());
}
