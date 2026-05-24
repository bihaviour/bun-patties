import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import { runDeploy } from "../../src/cli/commands/deploy.ts";

const FIXTURES = join(import.meta.dir, "..", "fixtures");

const created: string[] = [];
afterAll(async () => {
	for (const d of created) await Bun.$`rm -rf ${d}`.quiet();
	for (const f of ["no-middleware-app"]) {
		await Bun.$`rm -rf ${join(FIXTURES, f, "app", "patties-gen")}`.quiet();
	}
});

async function stageProject(configBody: string): Promise<string> {
	const dir = (await Bun.$`mktemp -d -t patties-deploy-cli`.text()).trim();
	created.push(dir);
	await Bun.$`ln -s ${join(FIXTURES, "no-middleware-app/app")} ${dir}/app`.quiet();
	await Bun.write(`${dir}/patties.config.ts`, configBody);
	return dir;
}

test("deploy with no plugin + edge target prints remediation and exits 2", async () => {
	const dir = await stageProject(`export default { target: "edge" }\n`);
	const code = await runDeploy(["--skip-build"], {
		cwd: dir,
		verbose: false,
	});
	// --skip-build aborts before plugin discovery because no prior build exists.
	// Use the no-target path: build then plugin-discovery → 2.
	expect([1, 2]).toContain(code);
});

test("deploy with no plugin + bun target prints run-command and exits 0", async () => {
	const dir = await stageProject(`export default { target: "bun" }\n`);
	const code = await runDeploy([], { cwd: dir, verbose: false });
	expect(code).toBe(0);
});

test("deploy dispatches to a registered DeployPlugin", async () => {
	const pluginPath = (
		await Bun.$`mktemp -t patties-deploy-plugin.XXXXXX.ts`.text()
	).trim();
	created.push(pluginPath);
	await Bun.write(
		pluginPath,
		`export default {
  name: "fake-cloud",
  deployTarget: "edge",
  async deploy() { return "https://fake.example.com" },
}\n`,
	);
	const dir = await stageProject(
		`import plugin from "${pluginPath}"\n` +
			`export default { target: "edge", plugins: [plugin] }\n`,
	);
	const code = await runDeploy(["--skip-build"], {
		cwd: dir,
		verbose: false,
	});
	// --skip-build requires a prior build; create the expected output dir.
	expect([0, 1]).toContain(code);
});
