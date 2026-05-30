import { expect, test } from "bun:test";
import { join } from "node:path";
import { copyAssets } from "../../src/build/assets.ts";

const FIXTURES = join(import.meta.dir, "..", "fixtures");

test("copyAssets with write:false enumerates + hashes but writes nothing", async () => {
	const outDir = (
		await Bun.$`mktemp -d -t patties-assets.XXXXXX`.text()
	).trim();
	try {
		const assets = await copyAssets(join(FIXTURES, "build-app/app"), outDir, {
			write: false,
		});
		const robots = assets.find((a) => a.src.endsWith("/robots.txt"));
		expect(robots).toBeDefined();
		expect(robots?.publicPath).toBe("/_patties/assets/robots.txt");
		expect(robots?.hash).toBeString();
		expect(await Bun.file(robots?.dest ?? "").exists()).toBeFalse();
	} finally {
		await Bun.$`rm -rf ${outDir}`.quiet();
	}
});

test("copyAssets default still writes to outDir/assets", async () => {
	const outDir = (
		await Bun.$`mktemp -d -t patties-assets.XXXXXX`.text()
	).trim();
	try {
		const assets = await copyAssets(join(FIXTURES, "build-app/app"), outDir);
		const robots = assets.find((a) => a.src.endsWith("/robots.txt"));
		expect(await Bun.file(robots?.dest ?? "").exists()).toBeTrue();
	} finally {
		await Bun.$`rm -rf ${outDir}`.quiet();
	}
});
