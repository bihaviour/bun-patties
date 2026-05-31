import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpgrade } from "../../src/cli/commands/upgrade.ts";
import { channelFor, isNewerVersion } from "../../src/cli/update-check.ts";

describe("channelFor", () => {
	test("stable version → latest", () => {
		expect(channelFor("0.0.11")).toBe("latest");
		expect(channelFor("1.2.3")).toBe("latest");
	});

	test("prerelease version → its pre tag", () => {
		expect(channelFor("0.1.0-next.3")).toBe("next");
		expect(channelFor("0.1.0-beta.0")).toBe("beta");
		expect(channelFor("2.0.0-rc.1")).toBe("rc");
	});
});

describe("isNewerVersion", () => {
	test("true only when latest is strictly greater", () => {
		expect(isNewerVersion("0.0.12", "0.0.11")).toBe(true);
		expect(isNewerVersion("1.0.0", "0.9.9")).toBe(true);
	});

	test("false for equal or older", () => {
		expect(isNewerVersion("0.0.11", "0.0.11")).toBe(false);
		expect(isNewerVersion("0.0.10", "0.0.11")).toBe(false);
	});

	test("stable is newer than its own prerelease", () => {
		expect(isNewerVersion("0.1.0", "0.1.0-next.3")).toBe(true);
		expect(isNewerVersion("0.1.0-next.3", "0.1.0")).toBe(false);
	});
});

describe("runUpgrade", () => {
	let workdir: string;

	beforeEach(async () => {
		workdir = await mkdtemp(join(tmpdir(), "patties-upgrade-"));
	});

	afterEach(async () => {
		await rm(workdir, { recursive: true, force: true });
	});

	const ctx = () =>
		({ cwd: workdir, verbose: false }) as Parameters<typeof runUpgrade>[1];

	test("--dry-run does not install and exits 0", async () => {
		await Bun.write(
			join(workdir, "package.json"),
			`${JSON.stringify({ name: "app", version: "0.0.0" })}\n`,
		);
		const code = await runUpgrade(["--dry-run"], ctx());
		expect(code).toBe(0);
		// A real install would have created node_modules / a lockfile.
		expect(await Bun.file(join(workdir, "bun.lock")).exists()).toBe(false);
	});

	test("refuses outside a project (no package.json)", async () => {
		const code = await runUpgrade(["--dry-run"], ctx());
		expect(code).toBe(2);
	});
});
