import { afterAll, describe, expect, test } from "bun:test";
import { loadConfig } from "../../src/config/load.ts";

const created: string[] = [];
afterAll(async () => {
	for (const d of created) await Bun.$`rm -rf ${d}`.quiet();
});

async function makeDir(): Promise<string> {
	const dir = (await Bun.$`mktemp -d -t patties-config.XXXXXX`.text()).trim();
	created.push(dir);
	return dir;
}

describe("loadConfig", () => {
	test("missing file → defaults", async () => {
		const dir = await makeDir();
		const { config, path } = await loadConfig(dir);
		expect(path).toBeNull();
		expect(config.target).toBe("bun");
		expect(config.appDir).toBe(`${dir}/app`);
		expect(config.outDir).toBe(`${dir}/.patties`);
	});

	test("patties.config.ts via defineConfig is parsed", async () => {
		const dir = await makeDir();
		await Bun.write(
			`${dir}/patties.config.ts`,
			`import { defineConfig } from "${import.meta.dir}/../../src/config/define.ts"\n` +
				`export default defineConfig({ target: "edge", server: { port: 4321 } })\n`,
		);
		const { config, path } = await loadConfig(dir);
		expect(path).toBe(`${dir}/patties.config.ts`);
		expect(config.target).toBe("edge");
		expect(config.server.port).toBe(4321);
	});

	test("malformed config throws a useful error", async () => {
		const dir = await makeDir();
		await Bun.write(
			`${dir}/patties.config.ts`,
			`export default { target: "node" }\n`,
		);
		await expect(loadConfig(dir)).rejects.toThrow(/target/);
	});
});
