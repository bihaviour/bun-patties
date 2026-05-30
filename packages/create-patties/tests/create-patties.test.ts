import { afterAll, expect, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import { run } from "../src/index.ts";
import { hasGit, probeTools } from "../src/probes.ts";
import { applyTemplate, renderTemplatesInTree } from "../src/readme.ts";

const created: string[] = [];
afterAll(async () => {
	for (const d of created) await Bun.$`rm -rf ${d}`.quiet();
});

async function mktemp(): Promise<string> {
	const d = (await Bun.$`mktemp -d -t patties-create.XXXXXX`.text()).trim();
	created.push(d);
	return d;
}

test("scaffolds default template in an empty dir", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run(["demo", "--no-install", "--no-git"]);
		expect(code).toBe(0);
		expect(existsSync(`${root}/demo/patties.config.ts`)).toBe(true);
		expect(existsSync(`${root}/demo/app/routes/index.tsx`)).toBe(true);
		const pkg = (await Bun.file(`${root}/demo/package.json`).json()) as {
			name: string;
		};
		expect(pkg.name).toBe("demo");
	} finally {
		process.chdir(prev);
	}
});

test("--agent claude-code is a backwards-compat alias for --template claude", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run([
			"demo",
			"--no-install",
			"--no-git",
			"--agent",
			"claude-code",
		]);
		expect(code).toBe(0);
		expect(existsSync(`${root}/demo/CLAUDE.md`)).toBe(true);
		expect(existsSync(`${root}/demo/.claude/settings.json`)).toBe(true);
	} finally {
		process.chdir(prev);
	}
});

test("--template claude scaffolds the full _claude overlay", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run([
			"demo",
			"--no-install",
			"--no-git",
			"--template",
			"claude",
		]);
		expect(code).toBe(0);
		expect(existsSync(`${root}/demo/CLAUDE.md`)).toBe(true);
		expect(existsSync(`${root}/demo/.claude/settings.json`)).toBe(true);
		expect(existsSync(`${root}/demo/.claude/hooks/biome-check.sh`)).toBe(true);
		expect(existsSync(`${root}/demo/.claude/skills/patties-cli/SKILL.md`)).toBe(
			true,
		);
		expect(existsSync(`${root}/demo/.claude/rules/bun-native.md`)).toBe(true);
		expect(existsSync(`${root}/demo/.claude/rules/islands.md`)).toBe(true);
		// Old placeholder dirs should be gone.
		expect(existsSync(`${root}/demo/.claude/agents`)).toBe(false);
		expect(existsSync(`${root}/demo/.claude/commands`)).toBe(false);
		// No codex contamination.
		expect(existsSync(`${root}/demo/AGENTS.md`)).toBe(false);
		expect(existsSync(`${root}/demo/.codex`)).toBe(false);
	} finally {
		process.chdir(prev);
	}
});

test("--template codex scaffolds the _codex overlay with no Claude leakage", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run([
			"demo",
			"--no-install",
			"--no-git",
			"--template",
			"codex",
		]);
		expect(code).toBe(0);
		expect(existsSync(`${root}/demo/AGENTS.md`)).toBe(true);
		expect(existsSync(`${root}/demo/.codex/README.md`)).toBe(true);
		const agents = await Bun.file(`${root}/demo/AGENTS.md`).text();
		// AGENTS.md is a thin index that links to focused rule files
		// under .codex/rules/ (parity with the _claude pattern).
		expect(agents).toContain(".codex/rules/bun-native.md");
		expect(agents).toContain(".codex/rules/islands.md");
		expect(agents).toContain(".codex/rules/patties-cli.md");
		expect(agents).toContain("patties:manifest-start");
		expect(agents).toContain("patties:manifest-end");
		// The rule files themselves must be present.
		expect(existsSync(`${root}/demo/.codex/rules/bun-native.md`)).toBe(true);
		expect(existsSync(`${root}/demo/.codex/rules/islands.md`)).toBe(true);
		expect(existsSync(`${root}/demo/.codex/rules/patties-cli.md`)).toBe(true);
		// Critical: no Claude-specific files under --template codex.
		expect(existsSync(`${root}/demo/CLAUDE.md`)).toBe(false);
		expect(existsSync(`${root}/demo/.claude`)).toBe(false);
	} finally {
		process.chdir(prev);
	}
});

test("README is generated with project name as H1 and deploy section", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run([
			"demo",
			"--no-install",
			"--no-git",
			"--target",
			"edge",
			"--deploy",
			"cloudflare",
		]);
		expect(code).toBe(0);
		const readme = await Bun.file(`${root}/demo/README.md`).text();
		expect(readme).toMatch(/^# demo\n/);
		expect(readme).toContain("**Cloudflare**");
		// Other deploy sections must be stripped.
		expect(readme).not.toContain("**Vercel**");
		expect(readme).not.toContain("**Netlify Edge**");
	} finally {
		process.chdir(prev);
	}
});

test("refuses non-empty target directory", async () => {
	const root = await mktemp();
	await Bun.write(`${root}/demo/already-here.txt`, "hi");
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run(["demo", "--no-install", "--no-git"]);
		expect(code).toBe(2);
	} finally {
		process.chdir(prev);
	}
});

test("invalid name exits 2", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run(["Bad Name", "--no-install", "--no-git"]);
		expect(code).toBe(2);
	} finally {
		process.chdir(prev);
	}
});

test("--yes produces a deterministic project (no prompts even in TTY)", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run(["demo", "--no-install", "--no-git", "--yes"]);
		expect(code).toBe(0);
		// Default --template is claude — no codex files should appear.
		expect(existsSync(`${root}/demo/CLAUDE.md`)).toBe(true);
		expect(existsSync(`${root}/demo/AGENTS.md`)).toBe(false);
	} finally {
		process.chdir(prev);
	}
});

test("git init is opt-in: no .git/ by default; --git creates one", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run(["demo", "--no-install"]);
		expect(code).toBe(0);
		expect(existsSync(`${root}/demo/.git`)).toBe(false);
	} finally {
		process.chdir(prev);
	}

	const root2 = await mktemp();
	process.chdir(root2);
	try {
		const code = await run(["demo", "--no-install", "--git"]);
		expect(code).toBe(0);
		expect(existsSync(`${root2}/demo/.git`)).toBe(true);
	} finally {
		process.chdir(prev);
	}
});

test.skipIf(!hasGit())(
	"--git never commits to a parent repo the scaffold sits inside",
	async () => {
		// Outer repo with a known HEAD; scaffolding into it must not touch it.
		const outer = await mktemp();
		// Clear git env vars — when run inside a pre-commit hook, GIT_INDEX_FILE
		// is inherited and would point at the parent repo's index, breaking git
		// commands in unrelated temp repos.
		const cleanEnv = {
			...process.env,
			GIT_INDEX_FILE: undefined,
			GIT_DIR: undefined,
			GIT_WORK_TREE: undefined,
		};
		await Bun.$`git init`.cwd(outer).env(cleanEnv).quiet();
		await Bun.$`git -c user.email=t@t -c user.name=t commit --allow-empty -m base`
			.cwd(outer)
			.env(cleanEnv)
			.quiet();
		const head = (await Bun.$`git rev-parse HEAD`.cwd(outer).text()).trim();

		const prev = process.cwd();
		process.chdir(outer);
		try {
			const code = await run(["demo", "--no-install", "--git"]);
			expect(code).toBe(0);
		} finally {
			process.chdir(prev);
		}

		// Outer repo's HEAD is untouched and gained no stray scaffold commit.
		expect((await Bun.$`git rev-parse HEAD`.cwd(outer).text()).trim()).toBe(
			head,
		);
		const log = await Bun.$`git log --oneline`.cwd(outer).text();
		expect(log).not.toContain("initial commit from create-patties");
		// The new project is its own repo and owns the commit instead.
		const demo = `${outer}/demo`;
		expect(
			(await Bun.$`git rev-parse --show-toplevel`.cwd(demo).text()).trim(),
		).toBe(realpathSync(demo));
		const demoLog = await Bun.$`git log --oneline`.cwd(demo).text();
		expect(demoLog).toContain("initial commit from create-patties");
	},
);

test("applyTemplate substitutes placeholders and keeps matching conditional blocks", () => {
	const out = applyTemplate(
		"# {{name}}\n<!-- if:agent=claude -->ok<!-- /if -->" +
			"<!-- if:agent=codex -->no<!-- /if -->",
		{
			name: "x",
			agent: "claude",
			target: "bun",
			deploy: "none",
			scaffold: "demo",
		},
	);
	expect(out).toContain("# x");
	expect(out).toContain("ok");
	expect(out).not.toContain("no");
});

test("default scaffold ships the todo demo", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run(["demo", "--no-install", "--no-git"]);
		expect(code).toBe(0);
		expect(existsSync(`${root}/demo/app/islands/TodoApp.tsx`)).toBe(true);
		expect(existsSync(`${root}/demo/app/islands/Counter.tsx`)).toBe(false);
		const route = await Bun.file(`${root}/demo/app/routes/index.tsx`).text();
		expect(route).toContain("TodoApp");
		const readme = await Bun.file(`${root}/demo/README.md`).text();
		expect(readme).toContain("Remove the demo");
		expect(readme).toContain("bun run build");
	} finally {
		process.chdir(prev);
	}
});

test("--blank scaffolds a hello-world page with no islands", async () => {
	const root = await mktemp();
	const prev = process.cwd();
	process.chdir(root);
	try {
		const code = await run(["demo", "--no-install", "--no-git", "--blank"]);
		expect(code).toBe(0);
		expect(existsSync(`${root}/demo/app/islands`)).toBe(false);
		const route = await Bun.file(`${root}/demo/app/routes/index.tsx`).text();
		expect(route).toContain("Hello from demo");
		expect(route).not.toContain("TodoApp");
		const readme = await Bun.file(`${root}/demo/README.md`).text();
		expect(readme).not.toContain("Remove the demo");
		expect(readme).toContain("Add your first interactive feature");
	} finally {
		process.chdir(prev);
	}
});

test("renderTemplatesInTree leaves non-templated files untouched", async () => {
	const root = await mktemp();
	await Bun.write(`${root}/plain.ts`, "const x = 1;\n");
	await Bun.write(`${root}/template.md`, "Hello {{name}}\n");
	await renderTemplatesInTree(root, {
		name: "world",
		agent: "none",
		target: "bun",
		deploy: "none",
		scaffold: "demo",
	});
	expect(await Bun.file(`${root}/plain.ts`).text()).toBe("const x = 1;\n");
	expect(await Bun.file(`${root}/template.md`).text()).toBe("Hello world\n");
});

test("probeTools exits 1 when bun is missing", () => {
	const original = Bun.which;
	let calledExit: number | undefined;
	let stderrMsg = "";
	try {
		(Bun as { which: typeof Bun.which }).which = ((cmd: string) =>
			cmd === "bun" ? null : "/usr/bin/git") as typeof Bun.which;
		probeTools({
			stderr: (m) => {
				stderrMsg = m;
			},
			exit: ((code: number) => {
				calledExit = code;
				throw new Error("__exit__");
			}) as never,
		});
	} catch (err) {
		expect((err as Error).message).toBe("__exit__");
	} finally {
		(Bun as { which: typeof Bun.which }).which = original;
	}
	expect(calledExit).toBe(1);
	expect(stderrMsg).toContain("`bun` not found");
});

test("hasGit returns false when git is missing", () => {
	const original = Bun.which;
	try {
		(Bun as { which: typeof Bun.which }).which = ((cmd: string) =>
			cmd === "git" ? null : "/usr/bin/bun") as typeof Bun.which;
		expect(hasGit()).toBe(false);
	} finally {
		(Bun as { which: typeof Bun.which }).which = original;
	}
});
