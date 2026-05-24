import { describe, expect, test } from "bun:test";
import { makeContext } from "../src/middleware/index.ts";
import { createRenderer } from "../src/render/index.tsx";
import type { RouteEntry } from "../src/types.ts";

const FIXTURES = import.meta.dir + "/fixtures";

function entryFor(filePath: string, bunPattern: string): RouteEntry {
	return {
		filePath,
		bunPattern,
		kind: "page",
		segments: [],
	};
}

describe("renderer", () => {
	test("returns streamed HTML with DOCTYPE and html content-type", async () => {
		const renderer = createRenderer({});
		const entry = entryFor(
			FIXTURES + "/basic-app/app/routes/about.tsx",
			"/about",
		);
		const req = new Request("http://localhost/about");
		const res = await renderer.renderPage(entry, req, makeContext(req));
		expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		const body = await res.text();
		expect(body.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(body).toContain("about page");
	});

	test("meta export produces <title>", async () => {
		const renderer = createRenderer({});
		const entry = entryFor(FIXTURES + "/basic-app/app/routes/index.tsx", "/");
		const req = new Request("http://localhost/");
		const res = await renderer.renderPage(entry, req, makeContext(req));
		const body = await res.text();
		expect(body).toContain("<title>Home</title>");
	});

	test("dev: true renders an error page for a broken module", async () => {
		const renderer = createRenderer({ dev: true });
		const entry = entryFor(
			FIXTURES + "/basic-app/app/routes/_does_not_exist.tsx",
			"/nope",
		);
		const req = new Request("http://localhost/nope");
		const res = await renderer.renderPage(entry, req, makeContext(req));
		expect(res.status).toBe(500);
		const body = await res.text();
		expect(body).toContain("Render error");
		// no raw markup from the message — escaped output should never contain
		// a raw `<script>` tag injected through the inspected error.
		expect(body.toLowerCase()).not.toContain("<script>alert");
	});

	test("dev: true injects HMR client script", async () => {
		const renderer = createRenderer({ dev: true });
		const entry = entryFor(
			FIXTURES + "/basic-app/app/routes/about.tsx",
			"/about",
		);
		const req = new Request("http://localhost/about");
		const res = await renderer.renderPage(entry, req, makeContext(req));
		const body = await res.text();
		expect(body).toContain("__patties_hmr");
	});
});
