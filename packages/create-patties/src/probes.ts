// Tool probes for the scaffolder. See spec cli/10-scaffold-probes.
//
// `bun` is required to run the resulting project — if it is missing from PATH
// at scaffold time, fail before any FS writes so the user does not end up with
// half a project on disk.
// `git` is optional — if it is missing, skip the `git init` step and warn at
// the end of the scaffold rather than letting git fail mid-pipeline.

export interface ProbeIO {
	stderr?: (msg: string) => void;
	exit?: (code: number) => never;
}

export function probeTools(io: ProbeIO = {}): void {
	const stderr = io.stderr ?? ((m: string) => process.stderr.write(`${m}\n`));
	const exit = io.exit ?? ((c: number) => process.exit(c) as never);

	if (!Bun.which("bun")) {
		stderr(
			"create-patties: `bun` not found in PATH. Install Bun from https://bun.sh and re-run.",
		);
		exit(1);
	}
}

export function hasGit(): boolean {
	return Bun.which("git") !== null;
}
