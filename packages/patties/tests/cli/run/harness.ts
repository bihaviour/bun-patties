// Shared harness for `patties run` integration tests: scaffolds a real
// Bun-workspace monorepo inside a temp git repo. A checked-in fixture can't carry
// its own `.git`, and the cache key / affected detection lean on git, so the
// monorepo is built programmatically and `git init`-ed per test for isolation.
//
// Package graph: a (leaf) ← b (depends on a), and c (independent). Each build
// script appends to a gitignored `.runs/<pkg>` sentinel so a test can prove a
// cache hit by asserting the script did NOT re-run.

import { join } from "node:path";
import { gitEnv } from "../../../src/cli/run/git.ts";

export interface Repo {
	dir: string;
	/** How many times `<pkg>`'s build script actually executed. */
	runCount(pkg: string): Promise<number>;
	/** Overwrite a package source file (leaves it unstaged / working-tree dirty). */
	editSource(pkg: string, value: string): Promise<void>;
	commitAll(message: string): Promise<void>;
	read(rel: string): Promise<string | null>;
	rm(rel: string): Promise<void>;
}

function buildScript(pkg: string, body: string): string {
	// cwd is the package dir; `.runs` lives at the repo root (two levels up).
	return `mkdir -p dist ../../.runs && echo ran >> ../../.runs/${pkg} && ${body}`;
}

const PKG_JSON = {
	a: {
		name: "a",
		version: "1.0.0",
		scripts: { build: buildScript("a", "cp src/v.txt dist/out.txt") },
	},
	b: {
		name: "b",
		version: "1.0.0",
		dependencies: { a: "workspace:*" },
		scripts: { build: buildScript("b", "echo b > dist/out.txt") },
	},
	c: {
		name: "c",
		version: "1.0.0",
		scripts: { build: buildScript("c", "echo c > dist/out.txt") },
	},
} as const;

export async function createMonorepo(): Promise<Repo> {
	const dir = (await Bun.$`mktemp -d -t patties-run-test.XXXXXX`.text()).trim();

	await Bun.write(
		join(dir, "package.json"),
		JSON.stringify({ name: "mono", private: true, workspaces: ["packages/*"] }),
	);
	await Bun.write(
		join(dir, ".gitignore"),
		"dist/\n.patties/\n.runs/\nnode_modules/\n",
	);
	await Bun.write(
		join(dir, "patties.config.ts"),
		`export default { tasks: { build: { inputs: ["src/**"], outputs: ["dist/**"] } } };\n`,
	);

	for (const [name, pkgJson] of Object.entries(PKG_JSON)) {
		await Bun.write(
			join(dir, "packages", name, "package.json"),
			JSON.stringify(pkgJson),
		);
		await Bun.write(join(dir, "packages", name, "src", "v.txt"), "1\n");
	}

	// `.env(gitEnv())` strips ambient GIT_* so these commands hit the temp repo,
	// never the real one — without it `git commit` under the pre-commit hook
	// (which exports GIT_DIR) would corrupt the actual working repository.
	await Bun.$`git init -q`.cwd(dir).env(gitEnv()).quiet();
	await Bun.$`git config user.email test@patties.dev`
		.cwd(dir)
		.env(gitEnv())
		.quiet();
	await Bun.$`git config user.name patties-test`.cwd(dir).env(gitEnv()).quiet();
	await Bun.$`git add -A`.cwd(dir).env(gitEnv()).quiet();
	await Bun.$`git commit -qm init`.cwd(dir).env(gitEnv()).quiet();

	return {
		dir,
		async runCount(pkg) {
			const file = Bun.file(join(dir, ".runs", pkg));
			if (!(await file.exists())) return 0;
			return (await file.text()).split("\n").filter((l) => l !== "").length;
		},
		async editSource(pkg, value) {
			await Bun.write(join(dir, "packages", pkg, "src", "v.txt"), value);
		},
		async commitAll(message) {
			await Bun.$`git add -A`.cwd(dir).env(gitEnv()).quiet();
			await Bun.$`git commit -qm ${message}`.cwd(dir).env(gitEnv()).quiet();
		},
		async read(rel) {
			const file = Bun.file(join(dir, rel));
			return (await file.exists()) ? file.text() : null;
		},
		async rm(rel) {
			await Bun.$`rm -rf ${join(dir, rel)}`.quiet();
		},
	};
}

export async function cleanup(repo: Repo): Promise<void> {
	await Bun.$`rm -rf ${repo.dir}`.quiet();
}
