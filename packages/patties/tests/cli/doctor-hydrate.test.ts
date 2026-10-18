import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkHydration } from "../../src/cli/doctor/hydrate.ts";

let cwd: string;

beforeEach(async () => {
	cwd = await mkdtemp(join(tmpdir(), "patties-doctor-hydrate-"));
});

afterEach(async () => {
	await rm(cwd, { recursive: true, force: true });
});

const page = (body: string) =>
	`${body}\nexport default function P() { return null; }\n`;

test("warns when a hydrated page also renders <Island>", async () => {
	await Bun.write(
		join(cwd, "app/routes/index.tsx"),
		page(
			`import { Island } from "patties/render";\nexport const hydrate = true;\nconst x = <Island name="c" />;`,
		),
	);
	const [finding] = await checkHydration(cwd, join(cwd, "app"), "off");
	expect(finding?.status).toBe("warn");
	expect(finding?.id).toBe("hydrate-islands");
	expect(finding?.detail).toContain("app/routes/index.tsx");
});

test("passes for hydrated pages without islands; silent when nothing hydrates", async () => {
	await Bun.write(
		join(cwd, "app/routes/a.tsx"),
		page("export const hydrate = true;"),
	);
	await Bun.write(join(cwd, "app/routes/b.tsx"), page(""));
	expect(await checkHydration(cwd, join(cwd, "app"), "off")).toEqual([
		{
			id: "hydrate",
			group: "Config",
			status: "pass",
			detail: "1 hydrated page(s), no island overlap",
		},
	]);
	await rm(join(cwd, "app/routes/a.tsx"));
	expect(await checkHydration(cwd, join(cwd, "app"), "off")).toEqual([]);
});

test("render.hydrate = pages counts pages without an explicit export", async () => {
	await Bun.write(
		join(cwd, "app/routes/b.tsx"),
		page(`const i = <Island name="x" />;`),
	);
	const [finding] = await checkHydration(cwd, join(cwd, "app"), "pages");
	expect(finding?.status).toBe("warn");
});

test("fails on a non-literal hydrate export", async () => {
	await Bun.write(
		join(cwd, "app/routes/c.tsx"),
		page("const on = true;\nexport const hydrate = on;"),
	);
	const [finding] = await checkHydration(cwd, join(cwd, "app"), "off");
	expect(finding?.status).toBe("fail");
});
