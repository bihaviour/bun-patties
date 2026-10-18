import { describe, expect, test } from "bun:test";
import {
	generatePageEntry,
	readHydrateFlag,
	stripServerExports,
} from "../../src/build/page-entry.ts";
import type { RouteEntry } from "../../src/types.ts";

const PAGE = `
import { Database } from "bun:sqlite";
import "./global.css";
import { useState } from "react";
export const hydrate = true;
export function loader() { return new Database(":memory:") && { n: 1 }; }
export function serialize(d) { return d; }
export function deserialize(d) { return d; }
export default function Page({ data }) {
	const [n, set] = useState(data.n);
	return <button onClick={() => set(n + 1)}>{n}</button>;
}
`;

describe("readHydrateFlag", () => {
	test("honors an explicit literal", () => {
		expect(readHydrateFlag(PAGE, "/p.tsx", "off").hydrate).toBeTrue();
		const off = "export const hydrate = false; export default () => null;";
		expect(readHydrateFlag(off, "/p.tsx", "pages").hydrate).toBeFalse();
	});

	test("falls back to the config default", () => {
		const src = "export default function P() { return null; }";
		expect(readHydrateFlag(src, "/p.tsx", "off").hydrate).toBeFalse();
		expect(readHydrateFlag(src, "/p.tsx", "pages").hydrate).toBeTrue();
	});

	test("rejects a non-literal hydrate export", () => {
		const src =
			"const on = true; export const hydrate = on; export default () => null;";
		expect(() => readHydrateFlag(src, "/p.tsx", "off")).toThrow(
			/literal boolean/,
		);
	});
});

describe("stripServerExports", () => {
	const out = stripServerExports(PAGE, "/app/routes/p.tsx");

	test("removes loader/serialize and the imports only they used", () => {
		expect(out).not.toContain("bun:sqlite");
		expect(out).not.toContain("loader");
		expect(out).not.toContain("function serialize");
	});

	test("keeps the page, deserialize, and authored side-effect imports", () => {
		expect(out).toContain("export default function Page");
		expect(out).toContain("deserialize");
		expect(out).toMatch(/import\s*"\.\/global\.css"/);
		expect(out).toContain('from "react/jsx-runtime"');
	});
});

describe("generatePageEntry", () => {
	const entry: RouteEntry = {
		filePath: "/app/routes/users/[id].tsx",
		bunPattern: "/users/:id",
		kind: "page",
		segments: [],
	};

	test("imports deserialize only when the page exports it", () => {
		const withHook = generatePageEntry(
			{ entry, id: "page-0-users-id", hasDeserialize: true },
			{ frameworkRoot: "/fw" },
		);
		expect(withHook).toContain(
			'import Page, { deserialize } from "/app/routes/users/[id].tsx"',
		);
		expect(withHook).toContain('bootPage("/users/:id", { Page, deserialize })');

		const plain = generatePageEntry(
			{ entry, id: "page-0-users-id", hasDeserialize: false },
			{ frameworkRoot: "/fw" },
		);
		expect(plain).not.toContain("deserialize");
		expect(plain).toContain('import { bootPage } from "/fw/client/page.ts"');
	});
});
