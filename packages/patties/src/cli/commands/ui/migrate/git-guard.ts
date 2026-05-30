// Working-tree state, used to refuse codemods on a dirty tree (so the rewrite
// is its own reviewable diff). Outside a git repo, `git status` errors → not a
// repo, and the caller requires --force.
export async function gitTreeState(
	cwd: string,
): Promise<{ isRepo: boolean; clean: boolean }> {
	try {
		const res = await Bun.$`git status --porcelain`.cwd(cwd).quiet();
		return { isRepo: true, clean: res.stdout.toString().trim().length === 0 };
	} catch {
		return { isRepo: false, clean: false };
	}
}
