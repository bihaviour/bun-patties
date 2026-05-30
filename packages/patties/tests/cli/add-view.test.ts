import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { components } from "patties-ui/registry";
import { setCatalogForTest } from "../../src/cli/commands/add/load-catalog.ts";
import { runAdd } from "../../src/cli/commands/add.ts";
import { renderComponentSource } from "../../src/cli/commands/ui/view.ts";
import { runView } from "../../src/cli/commands/view.ts";

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
	workdir = await mkdtemp(join(tmpdir(), "patties-view-"));
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

test("add --view prints metadata + source, writes nothing", async () => {
	const cap = captureOutput();
	const rc = await runAdd(["--view", "hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	// metadata header on stderr
	expect(captured.stderr).toContain("hello");
	expect(captured.stderr).toContain("phase");
	// source on stdout
	expect(captured.stdout).toContain("hello.tsx");
	// nothing stamped
	expect(
		await Bun.file(join(workdir, "app/components/ui/hello.tsx")).exists(),
	).toBe(false);
	expect(await Bun.file(join(workdir, "app/styles/tokens.css")).exists()).toBe(
		false,
	);
});

test("patties view is an alias", async () => {
	const cap = captureOutput();
	const rc = await runView(["hello"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	expect(captured.stdout).toContain("hello.tsx");
});

test("unknown component exits EXIT.USAGE", async () => {
	const cap = captureOutput();
	const rc = await runView(["nope"], ctx());
	cap.restore();
	expect(rc).toBe(2);
	expect(captured.stderr).toContain("unknown component: nope");
});

test("plain render (color:false) emits no ANSI and includes real source", async () => {
	const hello = components.find((c) => c.name === "hello");
	if (!hello) throw new Error("fixture component missing");
	const r = await renderComponentSource(hello, TEMPLATES, { color: false });
	// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting no ANSI escapes in piped source
	expect(r.source).not.toMatch(/\x1b\[/);
	const realSource = await Bun.file(
		join(TEMPLATES, "__fixtures__/hello.tsx"),
	).text();
	expect(r.source).toContain(realSource.trim().split("\n")[0] ?? "");
});
