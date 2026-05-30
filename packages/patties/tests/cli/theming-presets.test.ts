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
	workdir = await mkdtemp(join(tmpdir(), "patties-theme-"));
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

// slate's foreground hue (264.695) is unique to the slate preset.
const SLATE_MARKER = "oklch(0.129 0.042 264.695)";

test("add --theme slate merges slate token values", async () => {
	const cap = captureOutput();
	const rc = await runAdd(["--theme", "slate", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	const tokens = await Bun.file(tokensPath()).text();
	expect(tokens).toContain(SLATE_MARKER);
	expect(tokens).toContain("/* @patties:tokens base */");
});

test("default (no --theme) does not use slate values", async () => {
	const cap = captureOutput();
	await runAdd(["hello"], ctx());
	cap.restore();
	const tokens = await Bun.file(tokensPath()).text();
	expect(tokens).not.toContain(SLATE_MARKER);
});

test("ui init --theme zinc merges zinc values", async () => {
	const cap = captureOutput();
	const rc = await runUiInit(
		{ dryRun: false, force: false, theme: "zinc" },
		ctx(),
	);
	cap.restore();
	expect(rc).toBe(0);
	const tokens = await Bun.file(tokensPath()).text();
	// zinc foreground hue 285.823 is unique to zinc
	expect(tokens).toContain("oklch(0.141 0.005 285.823)");
});

test("unknown theme exits EXIT.USAGE, writes nothing", async () => {
	const cap = captureOutput();
	const rc = await runAdd(["--theme", "bogus", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(2);
	expect(captured.stderr).toContain("unknown theme preset");
	expect(await Bun.file(tokensPath()).exists()).toBe(false);
});

test("--theme with no value exits EXIT.USAGE", async () => {
	const cap = captureOutput();
	const rc = await runAdd(["--theme"], ctx());
	cap.restore();
	expect(rc).toBe(2);
	expect(captured.stderr).toContain("--theme requires");
});

test("re-stamp with a different theme is idempotent without --force", async () => {
	let cap = captureOutput();
	await runAdd(["--theme", "slate", "hello"], ctx());
	cap.restore();
	const first = await Bun.file(tokensPath()).text();

	// stamping another component without --force must not flip the base block
	cap = captureOutput();
	await runAdd(["alert"], ctx());
	cap.restore();
	expect(await Bun.file(tokensPath()).text()).toContain(SLATE_MARKER);
	expect(await Bun.file(tokensPath()).text()).toBe(first);
});
