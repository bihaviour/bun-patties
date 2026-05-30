import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { components } from "patties-ui/registry";
import type { ComponentEntry } from "patties-ui/types";
import { setCatalogForTest } from "../../src/cli/commands/add/load-catalog.ts";
import { runAdd } from "../../src/cli/commands/add.ts";

const TEMPLATES = join(
	import.meta.dir,
	"..",
	"..",
	"..",
	"patties-ui",
	"templates",
);

let workdir: string;

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "patties-add-local-"));
	setCatalogForTest({ components, templatesDir: TEMPLATES });
	await Bun.write(
		join(workdir, "package.json"),
		`${JSON.stringify({ name: "app", version: "0.0.0" }, null, "\t")}\n`,
	);
});

afterEach(async () => {
	setCatalogForTest(undefined);
	await rm(workdir, { recursive: true, force: true });
});

function ctx(): Parameters<typeof runAdd>[1] {
	return { cwd: workdir, verbose: false } as Parameters<typeof runAdd>[1];
}

const stampedPath = (name: string): string =>
	join(workdir, "app", "components", "ui", name);

describe("patties add <local-path>", () => {
	test("stamps a single local component file", async () => {
		const src = join(workdir, "vendor", "widget.tsx");
		await Bun.write(src, "export const Widget = () => null;\n");

		const rc = await runAdd(["./vendor/widget.tsx", "--yes"], ctx());
		expect(rc).toBe(0);
		expect(await Bun.file(stampedPath("widget.tsx")).exists()).toBe(true);
		expect(await Bun.file(stampedPath("widget.tsx")).text()).toContain(
			"export const Widget",
		);
	});

	test("stamps a built .json payload and records its deps", async () => {
		const entry: ComponentEntry = {
			name: "fancy",
			spec: "local:fancy",
			phase: 1,
			kind: "primitive",
			island: "no",
			status: "completed",
			files: [{ from: "fancy.tsx", to: "fancy.tsx" }],
			peerDeps: { "some-dep": "^1.0.0" },
			internalHelpers: [],
		};
		const payload = {
			entry,
			templates: { "fancy.tsx": "export const Fancy = () => null;\n" },
		};
		await Bun.write(
			join(workdir, "fancy.json"),
			JSON.stringify(payload, null, "\t"),
		);

		const rc = await runAdd(["./fancy.json", "--yes"], ctx());
		expect(rc).toBe(0);
		expect(await Bun.file(stampedPath("fancy.tsx")).exists()).toBe(true);

		const pkg = (await Bun.file(join(workdir, "package.json")).json()) as {
			dependencies?: Record<string, string>;
		};
		expect(pkg.dependencies?.["some-dep"]).toBe("^1.0.0");
	});

	test("a missing local file writes nothing and exits USAGE", async () => {
		const rc = await runAdd(["./nope.tsx", "--yes"], ctx());
		expect(rc).toBe(2);
		expect(await Bun.file(stampedPath("nope.tsx")).exists()).toBe(false);
	});
});
