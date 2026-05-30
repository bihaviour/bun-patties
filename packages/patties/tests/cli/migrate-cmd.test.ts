import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrate } from "../../src/cli/commands/migrate.ts";

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

// Strip git hook env vars so test-spawned `git` commands resolve relative to
// the tempdir, not the repo running the pre-commit hook.
function gitEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) {
		delete env[key];
	}
	return env;
}

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "patties-migrate-"));
	await Bun.write(
		join(workdir, "app/components/ui/dialog.tsx"),
		`import * as Dialog from "@radix-ui/react-dialog";\n`,
	);
});

afterEach(async () => {
	await rm(workdir, { recursive: true, force: true });
});

function ctx(): { cwd: string; verbose: boolean } {
	return { cwd: workdir, verbose: false };
}

test("refuses outside a git repo without --force", async () => {
	const cap = captureOutput();
	const rc = await runMigrate(["radix", "app/components/ui"], ctx());
	cap.restore();
	expect(rc).toBe(2);
	expect(captured.stderr).toContain("git");
});

test("--force lets it run outside git and rewrites the file", async () => {
	const cap = captureOutput();
	const rc = await runMigrate(["radix", "app/components/ui", "--force"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	const out = await Bun.file(
		join(workdir, "app/components/ui/dialog.tsx"),
	).text();
	expect(out).toBe(`import { Dialog } from "radix-ui";\n`);
});

test("--dry-run writes nothing", async () => {
	const cap = captureOutput();
	const rc = await runMigrate(
		["radix", "app/components/ui", "--force", "--dry-run"],
		ctx(),
	);
	cap.restore();
	expect(rc).toBe(0);
	const out = await Bun.file(
		join(workdir, "app/components/ui/dialog.tsx"),
	).text();
	expect(out).toBe(`import * as Dialog from "@radix-ui/react-dialog";\n`);
});

test("runs on a clean git tree without --force", async () => {
	await Bun.$`git init -q`.cwd(workdir).env(gitEnv()).quiet();
	await Bun.$`git add -A`.cwd(workdir).env(gitEnv()).quiet();
	await Bun.$`git -c user.email=t@t -c user.name=t commit -q -m init`
		.cwd(workdir)
		.env(gitEnv())
		.quiet();

	const cap = captureOutput();
	const rc = await runMigrate(["radix", "app/components/ui"], ctx());
	cap.restore();
	expect(rc).toBe(0);
	const out = await Bun.file(
		join(workdir, "app/components/ui/dialog.tsx"),
	).text();
	expect(out).toBe(`import { Dialog } from "radix-ui";\n`);
});

test("refuses on a dirty git tree without --force", async () => {
	await Bun.$`git init -q`.cwd(workdir).env(gitEnv()).quiet();
	// uncommitted file => dirty
	const cap = captureOutput();
	const rc = await runMigrate(["radix", "app/components/ui"], ctx());
	cap.restore();
	expect(rc).toBe(2);
	expect(captured.stderr).toContain("dirty");
});

test("missing kind prints help and exits EXIT.USAGE", async () => {
	const cap = captureOutput();
	const rc = await runMigrate([], ctx());
	cap.restore();
	expect(rc).toBe(2);
});
