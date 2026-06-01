// Group A — toolchain probes. Extends the scaffold's two probes (bun fail, git
// warn, cli/10-scaffold-probes) to a lifecycle set. The conditional docker /
// claude probes only emit a row when the project actually uses them, gated on
// file presence (a root Dockerfile / a `.claude/` dir) so projects that use
// neither are never nagged.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { padEnd } from "../ansi.ts";
import type { Probes } from "./probes.ts";
import { realProbes } from "./probes.ts";
import type { Finding } from "./types.ts";

/** Minimum Bun the framework declares as supported (matches the spec example). */
export const MIN_BUN = "1.3.0";

/** Compare dotted numeric versions: <0, 0, >0 like a sort comparator. */
function compareVersions(a: string, b: string): number {
	const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
	const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d !== 0) return d;
	}
	return 0;
}

export function checkToolchain(
	cwd: string,
	probes: Probes = realProbes,
): Finding[] {
	const out: Finding[] = [];

	const bunV = probes.bunVersion();
	if (compareVersions(bunV, MIN_BUN) >= 0) {
		out.push({
			id: "bun",
			group: "Toolchain",
			status: "pass",
			detail: `bun ${padEnd(bunV, 18)} (≥ ${MIN_BUN} required)`,
		});
	} else {
		out.push({
			id: "bun",
			group: "Toolchain",
			status: "fail",
			detail: `bun ${bunV} is older than the required ${MIN_BUN}`,
			remedy: "bun upgrade",
		});
	}

	if (probes.which("git")) {
		out.push({ id: "git", group: "Toolchain", status: "pass", detail: "git" });
	} else {
		out.push({
			id: "git",
			group: "Toolchain",
			status: "warn",
			detail: "git not found in PATH",
			remedy: "install git from https://git-scm.com",
		});
	}

	// docker — only relevant when the project ships a container build.
	if (existsSync(join(cwd, "Dockerfile"))) {
		out.push(
			probes.which("docker")
				? { id: "docker", group: "Toolchain", status: "pass", detail: "docker" }
				: {
						id: "docker",
						group: "Toolchain",
						status: "warn",
						detail: "Dockerfile present but docker not found in PATH",
						remedy: "install Docker from https://docs.docker.com/get-docker",
					},
		);
	}

	// claude — only relevant for `--agent claude` projects (a `.claude/` overlay).
	if (existsSync(join(cwd, ".claude"))) {
		out.push(
			probes.which("claude")
				? { id: "claude", group: "Toolchain", status: "pass", detail: "claude" }
				: {
						id: "claude",
						group: "Toolchain",
						status: "warn",
						detail: ".claude/ present but claude not found in PATH",
						remedy: "install Claude Code from https://claude.com/claude-code",
					},
		);
	}

	return out;
}
