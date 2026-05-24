import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { build } from "../../../src/build/index.ts";
import { runSmokeSuite, waitForListen, which } from "../smoke-harness.ts";

// Vercel Edge runtime is workerd-compatible. We reuse the workerd CLI as the
// minimal smoke harness — actual Vercel runtime shims would be layered on top
// of this; spec §"test-adapters" treats them as the same job kind.

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
	available = (await which("workerd")) !== null;
	if (!available) return;

	outDir = (await Bun.$`mktemp -d -t patties-vercel-smoke`.text()).trim();
	await build({
		appDir: FIXTURE,
		outDir,
		target: "edge",
		mode: "production",
	});

	const capnp = `${outDir}/config.capnp`;
	await Bun.write(
		capnp,
		`using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [(name = "main", worker = .worker)],
  sockets = [(name = "http", address = "127.0.0.1:${port}", http = (), service = "main")]
);
const worker :Workerd.Worker = (
  modules = [(name = "worker.js", esModule = embed "worker.js")],
  compatibilityDate = "2024-10-01"
);
`,
	);

	proc = Bun.spawn(["workerd", "serve", capnp], {
		cwd: outDir,
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

test("vercel-edge adapter smoke", async () => {
	if (!available) {
		console.log("skip: workerd not on PATH (vercel-edge uses workerd)");
		return;
	}
	expect(proc).not.toBeNull();
	await runSmokeSuite(base);
});
