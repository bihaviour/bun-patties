import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { components } from "patties-ui/registry";
import type { ComponentEntry } from "patties-ui/types";
import type { Catalog } from "../../src/cli/commands/add/load-catalog.ts";
import {
	cleanupSources,
	resolveSources,
} from "../../src/cli/commands/add/source.ts";

const TEMPLATES = join(
	import.meta.dir,
	"..",
	"..",
	"..",
	"patties-ui",
	"templates",
);

let workdir: string;

function entry(name: string): ComponentEntry {
	return {
		name,
		spec: `remote:${name}`,
		phase: 1,
		kind: "primitive",
		island: "no",
		status: "completed",
		files: [{ from: `${name}.tsx`, to: `${name}.tsx` }],
		peerDeps: {},
		internalHelpers: [],
	};
}

// A fetch stub that records the requested URL and returns a valid payload.
// Injected per-call so the suite never mutates globalThis.fetch.
function stubFetch(name: string): {
	fetch: typeof fetch;
	requested: () => string;
} {
	let requested = "";
	const impl = (async (input: string | URL | Request) => {
		requested = typeof input === "string" ? input : input.toString();
		return new Response(
			JSON.stringify({
				entry: entry(name),
				templates: { [`${name}.tsx`]: "export const C = () => null;\n" },
			}),
			{ status: 200 },
		);
	}) as typeof fetch;
	return { fetch: impl, requested: () => requested };
}

const catalog: Catalog = { components, templatesDir: TEMPLATES };

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "patties-add-remote-"));
});

afterEach(async () => {
	await rm(workdir, { recursive: true, force: true });
});

describe("url resolution", () => {
	test("fetches and validates an https payload", async () => {
		const stub = stubFetch("remotebtn");
		const sources = await resolveSources(["https://r.example/remotebtn.json"], {
			catalog,
			registries: {},
			cwd: workdir,
			allowInsecure: false,
			fetchImpl: stub.fetch,
		});
		expect(sources).not.toBeNull();
		expect(sources?.[0]?.entry.name).toBe("remotebtn");
		expect(
			await Bun.file(
				join(sources?.[0]?.templatesDir ?? "", "remotebtn.tsx"),
			).exists(),
		).toBe(true);
		await cleanupSources(sources ?? []);
	});

	test("rejects http without --allow-insecure and never fetches", async () => {
		let called = false;
		const impl = (async () => {
			called = true;
			return new Response("{}");
		}) as unknown as typeof fetch;
		const sources = await resolveSources(["http://insecure/x.json"], {
			catalog,
			registries: {},
			cwd: workdir,
			allowInsecure: false,
			fetchImpl: impl,
		});
		expect(sources).toBeNull();
		expect(called).toBe(false);
	});

	test("permits http with --allow-insecure", async () => {
		const stub = stubFetch("okhttp");
		const sources = await resolveSources(["http://insecure/okhttp.json"], {
			catalog,
			registries: {},
			cwd: workdir,
			allowInsecure: true,
			fetchImpl: stub.fetch,
		});
		expect(sources?.[0]?.entry.name).toBe("okhttp");
		await cleanupSources(sources ?? []);
	});

	test("a schema-invalid payload resolves to null", async () => {
		const impl = (async () =>
			new Response(JSON.stringify({ entry: { name: "bad" }, templates: {} }), {
				status: 200,
			})) as unknown as typeof fetch;
		const sources = await resolveSources(["https://r.example/bad.json"], {
			catalog,
			registries: {},
			cwd: workdir,
			allowInsecure: false,
			fetchImpl: impl,
		});
		expect(sources).toBeNull();
	});
});

describe("namespaced resolution", () => {
	test("maps @ns/name to the configured remote base", async () => {
		const stub = stubFetch("nsbtn");
		const sources = await resolveSources(["@acme/nsbtn"], {
			catalog,
			registries: { "@acme": "https://r.acme.dev/r" },
			cwd: workdir,
			allowInsecure: false,
			fetchImpl: stub.fetch,
		});
		expect(stub.requested()).toBe("https://r.acme.dev/r/nsbtn.json");
		expect(sources?.[0]?.entry.name).toBe("nsbtn");
		await cleanupSources(sources ?? []);
	});

	test("resolves a namespaced base that is a local directory", async () => {
		const baseDir = join(workdir, "local-registry");
		await Bun.write(
			join(baseDir, "localbtn.json"),
			JSON.stringify({
				entry: entry("localbtn"),
				templates: { "localbtn.tsx": "export const C = () => null;\n" },
			}),
		);
		const sources = await resolveSources(["@int/localbtn"], {
			catalog,
			registries: { "@int": baseDir },
			cwd: workdir,
			allowInsecure: false,
		});
		expect(sources?.[0]?.entry.name).toBe("localbtn");
		await cleanupSources(sources ?? []);
	});

	test("an unconfigured namespace resolves to null", async () => {
		const sources = await resolveSources(["@unknown/x"], {
			catalog,
			registries: {},
			cwd: workdir,
			allowInsecure: false,
		});
		expect(sources).toBeNull();
	});
});
