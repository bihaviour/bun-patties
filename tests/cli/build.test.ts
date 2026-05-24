import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import { runBuild } from "../../src/cli/build.ts";

const FIXTURES = join(import.meta.dir, "..", "fixtures");

const created: string[] = [];
afterAll(async () => {
	for (const d of created) await Bun.$`rm -rf ${d}`.quiet();
	for (const f of ["build-app", "no-middleware-app"]) {
		await Bun.$`rm -rf ${join(FIXTURES, f, "app", "patties-gen")}`.quiet();
	}
});

test("runBuild succeeds even when env.required would be unsatisfied (build is env-free)", async () => {
	// Stage a temp project root containing a patties.config.ts that names a
	// required env var we have not set. The build step must NOT validate env.
	const projectDir = (
		await Bun.$`mktemp -d -t patties-build-cli`.text()
	).trim();
	created.push(projectDir);

	// Symlink the fixture's app/ so the build has real source to scan.
	await Bun.$`ln -s ${join(FIXTURES, "no-middleware-app/app")} ${projectDir}/app`.quiet();
	await Bun.write(
		`${projectDir}/patties.config.ts`,
		`export default { env: { required: ["DEFINITELY_NOT_SET_${Date.now()}"] } }\n`,
	);

	const outDir = `${projectDir}/.patties`;
	const prevCwd = process.cwd();
	process.chdir(projectDir);
	try {
		const code = await runBuild(["--target", "bun", "--out", outDir]);
		expect(code).toBe(0);
		expect(await Bun.file(`${outDir}/server/server-entry.js`).exists()).toBe(
			true,
		);
	} finally {
		process.chdir(prevCwd);
	}
});

test("runBuild rejects an explicit unknown --target value", async () => {
	const projectDir = (
		await Bun.$`mktemp -d -t patties-build-cli-bad`.text()
	).trim();
	created.push(projectDir);
	await Bun.$`ln -s ${join(FIXTURES, "no-middleware-app/app")} ${projectDir}/app`.quiet();
	const prevCwd = process.cwd();
	process.chdir(projectDir);
	try {
		const code = await runBuild(["--target", "node"]);
		expect(code).toBe(1);
	} finally {
		process.chdir(prevCwd);
	}
});
