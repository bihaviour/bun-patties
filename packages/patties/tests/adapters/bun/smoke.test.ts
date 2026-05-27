import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { build } from "../../../src/build/index.ts";
import { runSmokeSuite, waitForListen } from "../smoke-harness.ts";

const FIXTURE = join(
	import.meta.dir,
	"..",
	"..",
	"fixtures",
	"edge-smoke",
	"app",
);

let outDir = "";
let proc: ReturnType<typeof Bun.spawn> | null = null;
let base = "";

const port = 30000 + Math.floor(Math.random() * 1000);

beforeAll(async () => {
	outDir = (await Bun.$`mktemp -d -t patties-bun-smoke.XXXXXX`.text()).trim();
	const result = await build({
		appDir: FIXTURE,
		outDir,
		target: "bun",
		mode: "production",
		port,
	});

	proc = Bun.spawn(["bun", result.serverEntry], {
		stdout: "pipe",
		stderr: "pipe",
	});
	base = `http://127.0.0.1:${port}`;
	await waitForListen(`${base}/`);
});

afterAll(async () => {
	proc?.kill();
	if (outDir) await Bun.$`rm -rf ${outDir}`.quiet();
});

test("bun adapter smoke", async () => {
	expect(proc).not.toBeNull();
	await runSmokeSuite(base);
});
