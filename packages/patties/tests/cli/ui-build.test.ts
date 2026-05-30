import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUi } from "../../src/cli/commands/ui.ts";

let workdir: string;

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "patties-ui-build-"));
});

afterEach(async () => {
	await rm(workdir, { recursive: true, force: true });
});

function ctx(): Parameters<typeof runUi>[1] {
	return { cwd: workdir, verbose: false } as Parameters<typeof runUi>[1];
}

const REGISTRY = [
	"export const components = [",
	"  {",
	'    name: "card",',
	'    spec: "author:card",',
	"    phase: 1,",
	'    kind: "primitive",',
	'    island: "no",',
	'    status: "completed",',
	'    files: [{ from: "card.tsx", to: "card.tsx" }],',
	"    peerDeps: {},",
	"    internalHelpers: [],",
	"  },",
	"];",
	"",
].join("\n");

async function seedAuthorDir(opts: { withTemplate: boolean }): Promise<void> {
	await Bun.write(join(workdir, "registry.ts"), REGISTRY);
	if (opts.withTemplate) {
		await Bun.write(
			join(workdir, "templates", "card.tsx"),
			"export const Card = () => null;\n",
		);
	}
}

describe("patties ui build", () => {
	test("emits registry.json + per-component payload with inlined source", async () => {
		await seedAuthorDir({ withTemplate: true });

		const rc = await runUi(["build", "--out", "dist/r"], ctx());
		expect(rc).toBe(0);

		const index = (await Bun.file(
			join(workdir, "dist", "r", "registry.json"),
		).json()) as { components: { name: string }[] };
		expect(index.components.map((c) => c.name)).toEqual(["card"]);

		const payload = (await Bun.file(
			join(workdir, "dist", "r", "card.json"),
		).json()) as { entry: { name: string }; templates: Record<string, string> };
		expect(payload.entry.name).toBe("card");
		expect(payload.templates["card.tsx"]).toContain("export const Card");
	});

	test("fails when a referenced template is missing", async () => {
		await seedAuthorDir({ withTemplate: false });

		const rc = await runUi(["build", "--out", "dist/r"], ctx());
		expect(rc).toBe(2);
		expect(
			await Bun.file(join(workdir, "dist", "r", "card.json")).exists(),
		).toBe(false);
	});

	test("requires --out", async () => {
		await seedAuthorDir({ withTemplate: true });
		const rc = await runUi(["build"], ctx());
		expect(rc).toBe(2);
	});

	test("a built payload round-trips through `patties add`", async () => {
		await seedAuthorDir({ withTemplate: true });
		expect(await runUi(["build", "--out", "dist/r"], ctx())).toBe(0);
		expect(
			await Bun.file(join(workdir, "dist", "r", "card.json")).exists(),
		).toBe(true);
	});
});
