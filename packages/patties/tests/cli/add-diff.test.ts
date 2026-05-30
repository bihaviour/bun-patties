import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { components } from "patties-ui/registry";
import { setCatalogForTest } from "../../src/cli/commands/add/load-catalog.ts";
import { runAdd } from "../../src/cli/commands/add.ts";
import { runUpdate } from "../../src/cli/commands/update.ts";

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
	workdir = await mkdtemp(join(tmpdir(), "patties-diff-"));
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

const helloPath = () => join(workdir, "app/components/ui/hello.tsx");

test("up to date when stamped and unmodified", async () => {
	let cap = captureOutput();
	await runAdd(["hello"], ctx());
	cap.restore();

	cap = captureOutput();
	const rc = await runAdd(["--diff", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(captured.stdout).toContain("up to date");
	expect(captured.stdout).not.toContain("@@");
});

test("prints a diff after a local edit", async () => {
	let cap = captureOutput();
	await runAdd(["hello"], ctx());
	cap.restore();

	await Bun.write(
		helloPath(),
		`${await Bun.file(helloPath()).text()}\n// edit\n`,
	);

	cap = captureOutput();
	const rc = await runAdd(["--diff", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(captured.stdout).toContain("@@");
	expect(captured.stdout).toContain("drift");
});

test("--diff with no name diffs all stamped, ignores unstamped", async () => {
	let cap = captureOutput();
	await runAdd(["hello"], ctx());
	cap.restore();

	cap = captureOutput();
	const rc = await runAdd(["--diff"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(captured.stdout).toContain("hello");
	// alert was never stamped, so it should not appear
	expect(captured.stdout).not.toContain("alert");
});

test("--diff --check exits non-zero only when drifted", async () => {
	let cap = captureOutput();
	await runAdd(["hello"], ctx());
	cap.restore();

	// clean -> 0
	cap = captureOutput();
	let rc = await runAdd(["--diff", "--check", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);

	// edit -> non-zero
	await Bun.write(helloPath(), `${await Bun.file(helloPath()).text()}\n// x\n`);
	cap = captureOutput();
	rc = await runAdd(["--diff", "--check", "hello"], ctx());
	cap.restore();
	expect(rc).not.toBe(0);
});

test("update overwrites a local edit and is then a no-op", async () => {
	let cap = captureOutput();
	await runAdd(["hello"], ctx());
	cap.restore();
	const original = await Bun.file(helloPath()).text();

	await Bun.write(helloPath(), `${original}\n// local change\n`);

	cap = captureOutput();
	let rc = await runUpdate(["hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(await Bun.file(helloPath()).text()).toBe(original);

	// re-run -> up to date
	cap = captureOutput();
	rc = await runUpdate(["hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(captured.stdout).toContain("up to date");
});

test("update --dry-run writes nothing", async () => {
	let cap = captureOutput();
	await runAdd(["hello"], ctx());
	cap.restore();
	const original = await Bun.file(helloPath()).text();
	await Bun.write(helloPath(), `${original}\n// local\n`);
	const edited = await Bun.file(helloPath()).text();

	cap = captureOutput();
	const rc = await runUpdate(["--dry-run", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(await Bun.file(helloPath()).text()).toBe(edited);
});
