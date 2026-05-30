import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { components } from "patties-ui/registry";
import { setCatalogForTest } from "../../src/cli/commands/add/load-catalog.ts";
import { runAdd } from "../../src/cli/commands/add.ts";
import { runUiInit } from "../../src/cli/commands/ui/init.ts";

const TEMPLATES = join(
	import.meta.dir,
	"..",
	"..",
	"..",
	"patties-ui",
	"templates",
);

const captured = { stdout: "", stderr: "" };

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
	workdir = await mkdtemp(join(tmpdir(), "patties-ui-init-"));
	setCatalogForTest({ components, templatesDir: TEMPLATES });
	await Bun.write(
		join(workdir, "package.json"),
		`${JSON.stringify({ name: "app", version: "0.0.0" }, null, "\t")}\n`,
	);
});

afterEach(async () => {
	setCatalogForTest(undefined);
	await rm(workdir, { recursive: true, force: true });
});

function ctx(): { cwd: string; verbose: boolean } {
	return { cwd: workdir, verbose: false };
}

const tokensPath = () => join(workdir, "app/styles/tokens.css");
const cnPath = () => join(workdir, "app/components/ui/_internal/cn.ts");

test("creates tokens + cn, patches package.json, prints wiring, no install", async () => {
	const cap = captureOutput();
	const rc = await runUiInit({ dryRun: false, force: false }, ctx());
	cap.restore();
	expect(rc).toBe(0);

	expect(await Bun.file(tokensPath()).exists()).toBe(true);
	expect(await Bun.file(cnPath()).exists()).toBe(true);
	expect(captured.stdout).toContain("@theme inline");

	const pkg = await Bun.file(join(workdir, "package.json")).json();
	expect(pkg.dependencies.clsx).toBeDefined();
	expect(pkg.dependencies["tailwind-merge"]).toBeDefined();
	// never runs install, only reminds
	expect(captured.stdout).toContain("bun install");
});

test("does not pre-stamp slot/variants helpers", async () => {
	const cap = captureOutput();
	await runUiInit({ dryRun: false, force: false }, ctx());
	cap.restore();
	expect(
		await Bun.file(
			join(workdir, "app/components/ui/_internal/slot.ts"),
		).exists(),
	).toBe(false);
	expect(
		await Bun.file(
			join(workdir, "app/components/ui/_internal/variants.ts"),
		).exists(),
	).toBe(false);
});

test("re-running is a no-op", async () => {
	let cap = captureOutput();
	await runUiInit({ dryRun: false, force: false }, ctx());
	cap.restore();
	const tokens = await Bun.file(tokensPath()).text();
	const cn = await Bun.file(cnPath()).text();

	cap = captureOutput();
	const rc = await runUiInit({ dryRun: false, force: false }, ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(await Bun.file(tokensPath()).text()).toBe(tokens);
	expect(await Bun.file(cnPath()).text()).toBe(cn);
});

test("--dry-run writes nothing", async () => {
	const cap = captureOutput();
	const rc = await runUiInit({ dryRun: true, force: false }, ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(await Bun.file(tokensPath()).exists()).toBe(false);
	expect(await Bun.file(cnPath()).exists()).toBe(false);
});

test("patties add after init skips tokens/cn", async () => {
	let cap = captureOutput();
	await runUiInit({ dryRun: false, force: false }, ctx());
	cap.restore();

	cap = captureOutput();
	const rc = await runAdd(["hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(captured.stdout).toContain("present");
});

test("refuses under NODE_ENV=production", async () => {
	const prev = process.env.NODE_ENV;
	process.env.NODE_ENV = "production";
	try {
		const cap = captureOutput();
		const rc = await runUiInit({ dryRun: false, force: false }, ctx());
		cap.restore();
		expect(rc).toBe(2);
		expect(captured.stderr).toContain("dev-only");
	} finally {
		if (prev === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = prev;
	}
});

test("honors config.ui.componentsDir / tokensFile", async () => {
	await Bun.write(
		join(workdir, "patties.config.ts"),
		`export default { ui: { componentsDir: "src/ui", tokensFile: "src/theme.css" } };\n`,
	);
	const cap = captureOutput();
	const rc = await runUiInit({ dryRun: false, force: false }, ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(await Bun.file(join(workdir, "src/theme.css")).exists()).toBe(true);
	expect(await Bun.file(join(workdir, "src/ui/_internal/cn.ts")).exists()).toBe(
		true,
	);
});
