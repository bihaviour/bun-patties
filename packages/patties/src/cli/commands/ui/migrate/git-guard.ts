// Working-tree state, used to refuse codemods on a dirty tree (so the rewrite
// is its own reviewable diff). Outside a git repo, `git status` errors → not a
// repo, and the caller requires --force.
export async function gitTreeState(
	cwd: string,
): Promise<{ isRepo: boolean; clean: boolean }> {
	// Strip git hook env vars so that `git status` resolves the repo from `cwd`
	// rather than inheriting GIT_DIR/GIT_INDEX_FILE from a running commit hook.
	const env = { ...process.env };
	for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) {
		delete env[key];
	}
	try {
		const res = await Bun.$`git status --porcelain`.cwd(cwd).env(env).quiet();
		return { isRepo: true, clean: res.stdout.toString().trim().length === 0 };
	} catch {
		return { isRepo: false, clean: false };
	}
}
