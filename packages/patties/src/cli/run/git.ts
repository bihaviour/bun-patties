// Every `git` invocation in `patties run` must target the workspace it was
// pointed at — discovered from the command's working directory — and never a
// different repo whose location leaked in through the environment. An enclosing
// git hook (pre-commit, etc.) exports GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE;
// a child `git` honors those over its cwd, so without stripping them
// `patties run` (or its tests) would read — or write — the hook's repo instead.
// Pass the result to `Bun.$\`…\`.env(gitEnv())`.
export function gitEnv(): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env))
		if (value !== undefined && !key.startsWith("GIT_")) out[key] = value;
	return out;
}
