// Toolchain probes for `patties doctor`, built on `Bun.which` (rfc-bun-which).
// Injectable so tests can simulate a missing `git` / `docker` / `claude` without
// touching the real PATH. The scaffold has its own copy in create-patties; this
// is the framework-package equivalent the doctor spec calls for.

export interface Probes {
	/** Absolute path of `tool` in PATH, or null when absent. */
	which(tool: string): string | null;
	/** The running Bun version (e.g. "1.3.14"). */
	bunVersion(): string;
}

export const realProbes: Probes = {
	which: (tool) => Bun.which(tool),
	bunVersion: () => Bun.version,
};
