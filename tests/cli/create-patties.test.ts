import { afterAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { run } from "../../packages/create-patties/src/index.ts";

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

test("--agent claude-code adds CLAUDE.md and .claude/", async () => {
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
