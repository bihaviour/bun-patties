import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { components } from "patties-ui/registry";
import { setCatalogForTest } from "../../src/cli/commands/add/load-catalog.ts";
import { runAdd } from "../../src/cli/commands/add.ts";

const TEMPLATES = join(
	import.meta.dir,
	"..",
	"..",
	"..",
	"patties-ui",
	"templates",
);

const captured: { stdout: string; stderr: string } = { stdout: "", stderr: "" };

function captureOutput(): { restore: () => void } {
	captured.stdout = "";
	captured.stderr = "";
	const origOut = process.stdout.write.bind(process.stdout);
	const origErr = process.stderr.write.bind(process.stderr);
	process.stdout.write = ((chunk: unknown) => {
		captured.stdout += String(chunk);
		return true;
	}) as typeof process.stdout.write;
	process.stderr.write = ((chunk: unknown) => {
		captured.stderr += String(chunk);
		return true;
	}) as typeof process.stderr.write;
	return {
		restore: () => {
			process.stdout.write = origOut;
			process.stderr.write = origErr;
		},
	};
}

let workdir: string;

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "patties-add-"));
	setCatalogForTest({ components, templatesDir: TEMPLATES });
});

afterEach(async () => {
	setCatalogForTest(undefined);
	await rm(workdir, { recursive: true, force: true });
});

async function writePkg(extra: Record<string, unknown> = {}): Promise<void> {
	await Bun.write(
		join(workdir, "package.json"),
		`${JSON.stringify({ name: "app", version: "0.0.0", ...extra }, null, "\t")}\n`,
	);
}

function ctx(): { cwd: string; verbose: boolean } {
	return { cwd: workdir, verbose: false };
}

describe("patties add", () => {
	test("--list prints the fixture row", async () => {
		await writePkg();
		const cap = captureOutput();
		const rc = await runAdd(["--list"], ctx());
		cap.restore();
		expect(rc).toBe(0);
		expect(captured.stdout).toContain("hello");
		expect(captured.stdout).toContain("completed");
	});

	test("refuses without package.json", async () => {
		const cap = captureOutput();
		const rc = await runAdd(["hello"], ctx());
		cap.restore();
		expect(rc).toBe(2);
		expect(captured.stderr).toContain("not a Patties project");
	});

	test("errors when patties-ui is not installed", async () => {
		await writePkg();
		setCatalogForTest(undefined);
		const cap = captureOutput();
		const rc = await runAdd(["hello"], { cwd: workdir, verbose: false });
		cap.restore();
		expect(rc).toBe(2);
		expect(captured.stderr).toContain("patties-ui is not installed");
		expect(captured.stderr).toContain("bun add -D patties-ui");
	});

	test("unknown component exits non-zero", async () => {
		await writePkg();
		const cap = captureOutput();
		const rc = await runAdd(["nope"], ctx());
		cap.restore();
		expect(rc).toBe(2);
		expect(captured.stderr).toContain("unknown component: nope");
	});

	test("--dry-run writes nothing", async () => {
		await writePkg();
		const cap = captureOutput();
		const rc = await runAdd(["--dry-run", "hello"], ctx());
		cap.restore();
		expect(rc).toBe(0);
		expect(captured.stdout).toContain("hello.tsx");
		const wrote = await Bun.file(
			join(workdir, "app", "components", "ui", "hello.tsx"),
		).exists();
		expect(wrote).toBe(false);
	});

	test("stamps the fixture, merges tokens, is idempotent", async () => {
		await writePkg();

		const cap1 = captureOutput();
		const rc1 = await runAdd(["hello"], ctx());
		cap1.restore();
		expect(rc1).toBe(0);

		const helloPath = join(workdir, "app", "components", "ui", "hello.tsx");
		const cnPath = join(
			workdir,
			"app",
			"components",
			"ui",
			"_internal",
			"cn.ts",
		);
		const tokensPath = join(workdir, "app", "styles", "tokens.css");

		expect(await Bun.file(helloPath).exists()).toBe(true);
		expect(await Bun.file(cnPath).exists()).toBe(true);
		expect(await Bun.file(tokensPath).exists()).toBe(true);

		const tokens = await Bun.file(tokensPath).text();
		expect(tokens).toContain("/* @patties:tokens base */");

		const cap2 = captureOutput();
		const rc2 = await runAdd(["hello"], ctx());
		cap2.restore();
		expect(rc2).toBe(0);
		expect(captured.stdout).toContain("skip");

		const tokensAfter = await Bun.file(tokensPath).text();
		expect(tokensAfter).toBe(tokens);
	});

	test("stamps pagination together with its button.tsx dependency", async () => {
		await writePkg();
		const cap = captureOutput();
		const rc = await runAdd(["pagination"], ctx());
		cap.restore();
		expect(rc).toBe(0);

		const uiDir = join(workdir, "app", "components", "ui");
		expect(await Bun.file(join(uiDir, "pagination.tsx")).exists()).toBe(true);
		expect(await Bun.file(join(uiDir, "button.tsx")).exists()).toBe(true);
		expect(await Bun.file(join(uiDir, "_internal", "slot.ts")).exists()).toBe(
			true,
		);

		const pagination = await Bun.file(join(uiDir, "pagination.tsx")).text();
		expect(pagination).toContain('from "./button.tsx"');
		expect(pagination).not.toContain("Phase 1 inlines button styling");

		const pkg = await Bun.file(join(workdir, "package.json")).json();
		expect(pkg.dependencies["class-variance-authority"]).toBeDefined();
	});

	test("refuses under NODE_ENV=production", async () => {
		const prev = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";
		try {
			const cap = captureOutput();
			const rc = await runAdd(["hello"], ctx());
			cap.restore();
			expect(rc).toBe(2);
			expect(captured.stderr).toContain("dev-only");
		} finally {
			if (prev === undefined) delete process.env.NODE_ENV;
			else process.env.NODE_ENV = prev;
		}
	});
});
