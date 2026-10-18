import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// End-to-end: a running `patties dev` must serve edits to existing routes and
// newly added / removed routes without a restart by the user. Regression for
// the dev bootstrap blocking the entry's top-level evaluation (which silently
// disables `bun --hot`) and for new files being invisible to the module graph.

const PKG_DIR = resolve(import.meta.dir, "../..");
const ROOT_NODE_MODULES = resolve(PKG_DIR, "../../node_modules");

const SERVER_TS = `import { type DevServer, setupDevClient } from "patties/dev";
import { createRenderer } from "patties/render";
import { createRouter } from "patties/router";
import { startServer } from "patties/server";

export default async function start(opts: {
	devServer: DevServer;
	port: number;
	host: string;
	appDir: string;
}): Promise<void> {
	const devClient = await setupDevClient({ appDir: opts.appDir });
	const renderer = createRenderer({ manifest: devClient.manifest, dev: true });
	const router = await createRouter({ appDir: opts.appDir, renderer });
	startServer({
		port: opts.port,
		hostname: opts.host,
		dev: true,
		devServer: opts.devServer,
		routes: { ...devClient.routes, ...router.routes },
		fallback: router.fallback,
	});
}
`;

const page = (marker: string) =>
	`export default function Page() { return <main><h1>${marker}</h1></main>; }\n`;

function freePort(): number {
	const s = Bun.serve({ port: 0, fetch: () => new Response() });
	const port = s.port ?? 0;
	s.stop(true);
	return port;
}

async function until(
	probe: () => Promise<boolean>,
	timeoutMs = 15_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			if (await probe()) return;
		} catch {
			// Server mid-restart; keep polling.
		}
		await Bun.sleep(100);
	}
	throw new Error("timed out waiting for the dev server");
}

describe("patties dev picks up route edits and additions without a restart", () => {
	let root: string;
	let routes: string;
	let base: string;
	let proc: ReturnType<typeof Bun.spawn>;
	let output = "";

	const get = async (path: string) => {
		const res = await fetch(`${base}${path}`);
		return { status: res.status, body: await res.text() };
	};

	beforeAll(async () => {
		root = mkdtempSync(join(tmpdir(), "patties-dev-reload-"));
		// Mirror an installed app: `node_modules/patties` resolves to this
		// package, and React comes from the same tree as the framework.
		symlinkSync(ROOT_NODE_MODULES, join(root, "node_modules"));
		writeFileSync(
			join(root, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { jsx: "react-jsx", jsxImportSource: "react" },
			}),
		);
		routes = join(root, "app/routes");
		mkdirSync(routes, { recursive: true });
		writeFileSync(join(root, "app/server.ts"), SERVER_TS);
		writeFileSync(join(routes, "index.tsx"), page("FIRST-RENDER"));

		const port = freePort();
		base = `http://127.0.0.1:${port}`;
		proc = Bun.spawn(
			[
				"bun",
				join(PKG_DIR, "bin/patties.ts"),
				"--no-update-check",
				"dev",
				"--no-open",
				"--host",
				"127.0.0.1",
				"--port",
				String(port),
			],
			{
				cwd: root,
				env: { ...process.env, NO_UPDATE_NOTIFIER: "1" },
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		for (const stream of [proc.stdout, proc.stderr]) {
			if (!(stream instanceof ReadableStream)) continue;
			stream.pipeTo(
				new WritableStream({
					write(chunk) {
						output += new TextDecoder().decode(chunk);
					},
				}),
			);
		}
		await until(async () => (await get("/")).body.includes("FIRST-RENDER"));
	}, 30_000);

	afterAll(async () => {
		proc?.kill("SIGTERM");
		await proc?.exited;
		rmSync(root, { recursive: true, force: true });
	});

	test("editing an already-served page re-renders it", async () => {
		writeFileSync(join(routes, "index.tsx"), page("EDITED-RENDER"));
		await until(async () => (await get("/")).body.includes("EDITED-RENDER"));
		expect(output).toContain("reloaded");
	}, 20_000);

	test("a newly added route is served", async () => {
		expect((await get("/about")).status).toBe(404);
		writeFileSync(join(routes, "about.tsx"), page("ABOUT-PAGE"));
		await until(async () => {
			const res = await get("/about");
			return res.status === 200 && res.body.includes("ABOUT-PAGE");
		});
	}, 20_000);

	test("edits to the newly added route are picked up too", async () => {
		writeFileSync(join(routes, "about.tsx"), page("ABOUT-EDITED"));
		await until(async () =>
			(await get("/about")).body.includes("ABOUT-EDITED"),
		);
	}, 20_000);

	test("a deleted route stops being served", async () => {
		unlinkSync(join(routes, "about.tsx"));
		await until(async () => (await get("/about")).status === 404);
		expect((await get("/")).body).toContain("EDITED-RENDER");
	}, 20_000);
});
