import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { build } from "../../../src/build/index.ts";
import { runSmokeSuite, waitForListen, which } from "../smoke-harness.ts";

// Netlify Edge runs on Deno Deploy. We reuse `deno serve` as the smoke harness;
// Netlify-specific shims would be layered on top. Spec §"test-adapters" treats
// the netlify-edge leg as deno-shaped.

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
let available = false;

const port = 30000 + Math.floor(Math.random() * 1000);

beforeAll(async () => {
	available = (await which("deno")) !== null;
	if (!available) return;

	outDir = (await Bun.$`mktemp -d -t patties-netlify-smoke`.text()).trim();
	await build({
		appDir: FIXTURE,
		outDir,
		target: "edge",
		mode: "production",
	});

	proc = Bun.spawn(
		[
			"deno",
			"serve",
			"--allow-net",
			"--allow-read",
			"--port",
			String(port),
			`${outDir}/worker.js`,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	base = `http://127.0.0.1:${port}`;
	await waitForListen(`${base}/`);
});

afterAll(async () => {
	proc?.kill();
	if (outDir) await Bun.$`rm -rf ${outDir}`.quiet();
});

test("netlify-edge adapter smoke", async () => {
	if (!available) {
		console.log("skip: deno not on PATH (netlify-edge uses deno)");
		return;
	}
	expect(proc).not.toBeNull();
	await runSmokeSuite(base);
});
