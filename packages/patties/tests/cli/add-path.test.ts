import { afterEach, beforeEach, expect, test } from "bun:test";
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
	workdir = await mkdtemp(join(tmpdir(), "patties-add-path-"));
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

test("--path stamps into the redirected dir, helpers follow, tokens do not", async () => {
	const cap = captureOutput();
	const rc = await runAdd(["--path", "src/ui", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);

	expect(await Bun.file(join(workdir, "src/ui/hello.tsx")).exists()).toBe(true);
	expect(await Bun.file(join(workdir, "src/ui/_internal/cn.ts")).exists()).toBe(
		true,
	);
	// nothing in the convention dir
	expect(
		await Bun.file(join(workdir, "app/components/ui/hello.tsx")).exists(),
	).toBe(false);
	// tokens stay at the convention path
	expect(await Bun.file(join(workdir, "app/styles/tokens.css")).exists()).toBe(
		true,
	);
});

test("--path with no value exits EXIT.USAGE", async () => {
	const cap = captureOutput();
	const rc = await runAdd(["--path"], ctx());
	cap.restore();
	expect(rc).toBe(2);
	expect(captured.stderr).toContain("--path requires");
});

test("absolute --path exits EXIT.USAGE, writes nothing", async () => {
	const cap = captureOutput();
	const rc = await runAdd(["--path", "/etc", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(2);
	expect(await Bun.file("/etc/hello.tsx").exists()).toBe(false);
});

test("escaping --path exits EXIT.USAGE", async () => {
	const cap = captureOutput();
	const rc = await runAdd(["--path", "../../outside", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(2);
});

test("--path + --dry-run reflects the redirect and writes nothing", async () => {
	const cap = captureOutput();
	const rc = await runAdd(["--path", "src/ui", "--dry-run", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(captured.stdout).toContain(join(workdir, "src/ui/hello.tsx"));
	expect(await Bun.file(join(workdir, "src/ui/hello.tsx")).exists()).toBe(
		false,
	);
});

test("config.ui.componentsDir is used when no --path; --path overrides it", async () => {
	await Bun.write(
		join(workdir, "patties.config.ts"),
		`export default { ui: { componentsDir: "configured/ui" } };\n`,
	);

	// no --path -> config dir
	let cap = captureOutput();
	let rc = await runAdd(["hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(
		await Bun.file(join(workdir, "configured/ui/hello.tsx")).exists(),
	).toBe(true);

	// --path overrides config for this invocation
	cap = captureOutput();
	rc = await runAdd(["--path", "override/ui", "alert"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(await Bun.file(join(workdir, "override/ui/alert.tsx")).exists()).toBe(
		true,
	);
	expect(
		await Bun.file(join(workdir, "configured/ui/alert.tsx")).exists(),
	).toBe(false);
});
