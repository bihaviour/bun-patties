import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	auditFinding,
	parseAuditJson,
	parseOutdatedTable,
} from "../../src/cli/doctor/deps.ts";
import { checkToolchain } from "../../src/cli/doctor/toolchain.ts";
import type { Summary } from "../../src/cli/doctor/types.ts";
import { decideExit, runDoctor } from "../../src/cli/doctor.ts";

// ── output capture ────────────────────────────────────────────────────────
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

const dirs: string[] = [];

afterAll(async () => {
	for (const d of dirs) await rm(d, { recursive: true, force: true });
});

async function makeProject(files: Record<string, string>): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "patties-doctor-"));
	dirs.push(dir);
	for (const [rel, content] of Object.entries(files)) {
		await Bun.write(join(dir, rel), content);
	}
	return dir;
}

function ctx(dir: string): { cwd: string; verbose: boolean } {
	return { cwd: dir, verbose: false };
}

const VALID_CONFIG = `export default { appDir: "./app" }\n`;
const LOCK = (deps: string[]) =>
	JSON.stringify({
		lockfileVersion: 1,
		workspaces: { "": { dependencies: {} } },
		packages: Object.fromEntries(
			deps.map((d) => [d, [`${d}@1.0.0`, "", {}, "x"]]),
		),
	});

async function run(dir: string, argv: string[]): Promise<number> {
	const cap = captureOutput();
	try {
		return await runDoctor(argv, ctx(dir));
	} finally {
		cap.restore();
	}
}

// ── pure parsers ──────────────────────────────────────────────────────────
describe("parseOutdatedTable", () => {
	const table = [
		"| Package              | Current | Update | Latest |",
		"|----------------------|---------|--------|--------|",
		"| @biomejs/biome (dev) | 2.4.15  | 2.4.15 | 2.4.16 |",
		"| react                | 18.2.0  | 18.3.0 | 19.0.0 |",
	].join("\n");

	test("parses rows, strips (dev), flags major drift", () => {
		const rows = parseOutdatedTable(table);
		expect(rows).toHaveLength(2);
		const biome = rows.find((r) => r.name === "@biomejs/biome");
		expect(biome?.major).toBe(false);
		const react = rows.find((r) => r.name === "react");
		expect(react?.major).toBe(true);
	});

	test("empty output → []", () => {
		expect(parseOutdatedTable("")).toEqual([]);
		expect(parseOutdatedTable("Resolving...\n")).toEqual([]);
	});
});

describe("parseAuditJson + auditFinding", () => {
	const sample = JSON.stringify({
		advisories: {
			"1": { module_name: "left-pad", severity: "high" },
			"2": { module_name: "foo", severity: "low" },
		},
	});

	test("extracts advisories with severity", () => {
		const adv = parseAuditJson(sample);
		expect(adv).toHaveLength(2);
		expect(adv.find((a) => a.name === "left-pad")?.severity).toBe("high");
	});

	test("non-JSON → []", () => {
		expect(parseAuditJson("bun audit: error\n")).toEqual([]);
	});

	test("high advisory fails at default level, warns at critical", () => {
		const adv = parseAuditJson(sample);
		expect(auditFinding(adv, "high").status).toBe("fail");
		expect(auditFinding(adv, "critical").status).toBe("warn");
	});

	test("no advisories → pass", () => {
		expect(auditFinding([], "high").status).toBe("pass");
	});
});

describe("decideExit", () => {
	const s = (over: Partial<Summary>): Summary => ({
		failed: 0,
		warning: 0,
		passed: 0,
		skipped: 0,
		...over,
	});
	test("fail always gates", () => {
		expect(decideExit(s({ failed: 1 }), false)).toBe(1);
	});
	test("warning gates only under --strict", () => {
		expect(decideExit(s({ warning: 1 }), false)).toBe(0);
		expect(decideExit(s({ warning: 1 }), true)).toBe(1);
	});
	test("skip never gates", () => {
		expect(decideExit(s({ skipped: 3, passed: 2 }), true)).toBe(0);
	});
});

describe("checkToolchain", () => {
	test("missing git → warn; bun below floor → fail", () => {
		const dir = "/nonexistent";
		const findings = checkToolchain(dir, {
			which: () => null,
			bunVersion: () => "1.2.0",
		});
		expect(findings.find((f) => f.id === "git")?.status).toBe("warn");
		expect(findings.find((f) => f.id === "bun")?.status).toBe("fail");
	});

	test("docker/claude rows absent without Dockerfile/.claude", () => {
		const findings = checkToolchain("/nonexistent", {
			which: () => "/usr/bin/x",
			bunVersion: () => "1.3.14",
		});
		expect(findings.some((f) => f.id === "docker")).toBe(false);
		expect(findings.some((f) => f.id === "claude")).toBe(false);
	});
});

// ── pre-flight ────────────────────────────────────────────────────────────
test("no patties config → exit 2", async () => {
	const dir = await makeProject({ "package.json": "{}" });
	expect(await run(dir, ["--offline"])).toBe(2);
	expect(captured.stderr).toContain("not a patties project");
});

test("invalid --audit-level → exit 2", async () => {
	const dir = await makeProject({ "patties.config.ts": VALID_CONFIG });
	expect(await run(dir, ["--audit-level", "bogus"])).toBe(2);
});

// ── offline / json ────────────────────────────────────────────────────────
test("--offline reports audit + outdated as skipped, exits 0", async () => {
	const dir = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": "{}",
		"bun.lock": LOCK([]),
	});
	expect(await run(dir, ["--offline"])).toBe(0);
	expect(captured.stdout).toContain("skipped (offline)");
	expect(captured.stdout).not.toContain("security audit passed");
});

test("--json emits stable shape with no ANSI", async () => {
	const dir = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": "{}",
		"bun.lock": LOCK([]),
	});
	const cap = captureOutput();
	const code = await runDoctor(["--offline", "--json"], ctx(dir));
	cap.restore();
	expect(code).toBe(0);
	// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting NO ANSI escapes
	expect(captured.stdout).not.toMatch(/\x1b\[/);
	const parsed = JSON.parse(captured.stdout) as {
		checks: { id: string; status: string }[];
		summary: Summary;
	};
	expect(Array.isArray(parsed.checks)).toBe(true);
	expect(parsed.checks.find((c) => c.id === "config")?.status).toBe("pass");
	expect(parsed.summary.passed).toBeGreaterThan(0);
});

// ── lockfile ──────────────────────────────────────────────────────────────
test("lockfile drift (dep not installed) → fail with bun install remedy", async () => {
	const dir = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": JSON.stringify({ dependencies: { "left-pad": "^1.0.0" } }),
		"bun.lock": LOCK([]),
	});
	expect(await run(dir, ["--offline"])).toBe(1);
	expect(captured.stdout).toContain("out of sync");
	expect(captured.stdout).toContain("bun install");
});

test("missing bun.lock → fail", async () => {
	const dir = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": "{}",
	});
	expect(await run(dir, ["--offline"])).toBe(1);
	expect(captured.stdout).toContain("bun.lock is missing");
});

test("lockfile in sync → pass", async () => {
	const dir = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": JSON.stringify({ dependencies: { "left-pad": "^1.0.0" } }),
		"bun.lock": LOCK(["left-pad"]),
	});
	expect(await run(dir, ["--offline"])).toBe(0);
	expect(captured.stdout).toContain("lockfile in sync");
});

// ── config ────────────────────────────────────────────────────────────────
test("schema-violating config → fail with issue path", async () => {
	const dir = await makeProject({
		"patties.config.ts": `export default { target: "nope" }\n`,
		"package.json": "{}",
		"bun.lock": LOCK([]),
	});
	expect(await run(dir, ["--offline"])).toBe(1);
	expect(captured.stdout).toContain("patties.config.ts invalid");
	expect(captured.stdout).toContain("target");
});

test("malformed biome.json → fail; absent → no biome row", async () => {
	const bad = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": "{}",
		"bun.lock": LOCK([]),
		"biome.json": "{ not json",
	});
	expect(await run(bad, ["--offline"])).toBe(1);
	expect(captured.stdout).toContain("biome.json is not valid JSON");

	const none = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": "{}",
		"bun.lock": LOCK([]),
	});
	await run(none, ["--offline"]);
	expect(captured.stdout).not.toContain("biome.json");
});

// ── monorepo ──────────────────────────────────────────────────────────────
test("single-package project omits the Monorepo group", async () => {
	const dir = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": "{}",
		"bun.lock": LOCK([]),
	});
	await run(dir, ["--offline"]);
	expect(captured.stdout).not.toContain("Monorepo");
});

test("workspace glob matching no package → fail", async () => {
	const dir = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": JSON.stringify({ workspaces: ["packages/*", "apps/*"] }),
		"bun.lock": LOCK([]),
		"packages/web/package.json": JSON.stringify({ name: "web" }),
	});
	expect(await run(dir, ["--offline"])).toBe(1);
	expect(captured.stdout).toContain("Monorepo");
	expect(captured.stdout).toContain("matched no package");
	expect(captured.stdout).toContain("apps/*");
});

test("dangling catalog reference → fail", async () => {
	const dir = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": JSON.stringify({ workspaces: ["packages/*"] }),
		"bun.lock": LOCK([]),
		"packages/web/package.json": JSON.stringify({
			name: "web",
			dependencies: { "some-lib": "catalog:" },
		}),
	});
	expect(await run(dir, ["--offline"])).toBe(1);
	expect(captured.stdout).toContain("dangling catalog reference");
});

test("two React copies → single-React fail", async () => {
	const dir = await makeProject({
		"patties.config.ts": VALID_CONFIG,
		"package.json": JSON.stringify({ workspaces: ["packages/*"] }),
		"bun.lock": LOCK([]),
		"packages/a/package.json": JSON.stringify({ name: "a" }),
		"packages/a/node_modules/react/package.json": JSON.stringify({
			name: "react",
			version: "18.3.1",
		}),
		"packages/b/package.json": JSON.stringify({ name: "b" }),
		"packages/b/node_modules/react/package.json": JSON.stringify({
			name: "react",
			version: "19.0.0",
		}),
	});
	expect(await run(dir, ["--offline"])).toBe(1);
	expect(captured.stdout).toContain("copies of React");
});
