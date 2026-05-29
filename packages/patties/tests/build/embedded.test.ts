import { expect, test } from "bun:test";
import {
	collectClientChunks,
	type EmbeddedEntry,
	generateEmbeddedManifest,
} from "../../src/build/embedded.ts";

test("generateEmbeddedManifest emits one file import per entry and a url map", () => {
	const entries: EmbeddedEntry[] = [
		{ url: "/_patties/assets/robots.txt", src: "/abs/app/public/robots.txt" },
		{
			url: "/_patties/client/counter-abc123.js",
			src: "/abs/out/client/counter-abc123.js",
		},
	];
	const src = generateEmbeddedManifest(entries);
	expect(src).toContain(
		'import a0 from "/abs/app/public/robots.txt" with { type: "file" };',
	);
	expect(src).toContain(
		'import a1 from "/abs/out/client/counter-abc123.js" with { type: "file" };',
	);
	expect(src).toContain("export const EMBEDDED_ASSET_PATHS");
	expect(src).toContain('"/_patties/assets/robots.txt": a0,');
	expect(src).toContain('"/_patties/client/counter-abc123.js": a1,');
});

test("generateEmbeddedManifest with no entries emits an empty map and no imports", () => {
	const src = generateEmbeddedManifest([]);
	expect(src).toContain("export const EMBEDDED_ASSET_PATHS");
	expect(src).not.toContain("import a0");
});

test("collectClientChunks returns chunk urls + absolute paths", async () => {
	const dir = (await Bun.$`mktemp -d -t patties-chunks.XXXXXX`.text()).trim();
	try {
		await Bun.write(`${dir}/counter-abc.js`, "console.log(1)");
		await Bun.write(`${dir}/counter-abc.js.map`, "{}");
		const chunks = await collectClientChunks(dir);
		const js = chunks.find((c) => c.url.endsWith("counter-abc.js"));
		expect(js?.url).toBe("/_patties/client/counter-abc.js");
		expect(js?.src).toBe(`${dir}/counter-abc.js`);
		expect(chunks.length).toBe(2);
	} finally {
		await Bun.$`rm -rf ${dir}`.quiet();
	}
});

test("collectClientChunks returns [] when the dir is absent", async () => {
	expect(await collectClientChunks("/no/such/dir/xyz-patties")).toEqual([]);
});
