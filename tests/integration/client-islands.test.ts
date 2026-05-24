import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { join } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "../../src/build/index.ts";
import { Island } from "../../src/render/island.tsx";

const FIXTURES = join(import.meta.dir, "..", "fixtures");
const createdDirs: string[] = [];

afterAll(async () => {
	for (const d of createdDirs) await Bun.$`rm -rf ${d}`.quiet();
	for (const f of ["build-app", "no-middleware-app", "multi-island-app"]) {
		await Bun.$`rm -rf ${join(FIXTURES, f, "app", "patties-gen")}`.quiet();
	}
});

async function makeOut(): Promise<string> {
	const out = (await Bun.$`mktemp -d -t patties-islands.XXXXXX`.text()).trim();
	createdDirs.push(out);
	return out;
}

// --- createClient: module surface, registry, hydrateAll ---

// Stub out react-dom/client.hydrateRoot so we can assert it was called without
// running real React DOM hydration (which needs a full DOM matching the SSR
// HTML). The DOM here is a hand-rolled fake — just enough surface for the
// runtime's querySelectorAll / nextElementSibling / matches calls.

function buildFakeDom(html: { name: string; props?: object }[]) {
	// Build a flat list of "elements" representing markers + script siblings.
	type FakeEl = {
		tagName: string;
		attrs: Record<string, string>;
		textContent: string;
		nextElementSibling: FakeEl | null;
		getAttribute(k: string): string | null;
		matches(sel: string): boolean;
	};

	const els: FakeEl[] = [];
	for (const { name, props } of html) {
		const marker: FakeEl = {
			tagName: "DIV",
			attrs: { "data-island": name },
			textContent: "",
			nextElementSibling: null,
			getAttribute(k) {
				return this.attrs[k] ?? null;
			},
			matches(sel) {
				return matchesSel(this, sel);
			},
		};
		const script: FakeEl = {
			tagName: "SCRIPT",
			attrs: {
				type: "application/json",
				"data-props": "",
				"data-for": name,
			},
			textContent: JSON.stringify(props ?? {}),
			nextElementSibling: null,
			getAttribute(k) {
				return this.attrs[k] ?? null;
			},
			matches(sel) {
				return matchesSel(this, sel);
			},
		};
		marker.nextElementSibling = script;
		els.push(marker, script);
	}

	return {
		readyState: "complete" as const,
		querySelectorAll(sel: string): FakeEl[] {
			if (sel === "[data-island]") {
				return els.filter((e) => "data-island" in e.attrs);
			}
			return [];
		},
		addEventListener() {},
	};
}

function matchesSel(
	el: { tagName: string; attrs: Record<string, string> },
	sel: string,
): boolean {
	// Only support the exact selector the runtime uses:
	//   script[data-props][data-for="<name>"]
	const m = sel.match(/^script\[data-props\]\[data-for="([^"]+)"\]$/);
	if (!m) return false;
	return (
		el.tagName === "SCRIPT" &&
		"data-props" in el.attrs &&
		el.attrs["data-for"] === m[1]
	);
}

beforeEach(() => {
	// Reset module + global state for each test.
	(globalThis as { document: unknown }).document = undefined;
});

test("createClient.register + hydrateAll calls hydrateRoot per marker with parsed props", async () => {
	const hydrateRoot = mock(() => ({ unmount() {}, render() {} }));
	mock.module("react-dom/client", () => ({ hydrateRoot }));

	(globalThis as { document: unknown }).document = buildFakeDom([
		{ name: "counter", props: { start: 7 } },
	]);

	// Fresh import so the mocked react-dom/client is used.
	const { createClient } = await import(
		`../../src/client/index.ts?t=${Date.now()}`
	);
	const client = createClient();
	const Counter = (props: { start: number }) =>
		React.createElement("button", { type: "button" }, `n=${props.start}`);
	client.register("counter", Counter);
	client.hydrateAll();

	expect(hydrateRoot).toHaveBeenCalledTimes(1);
	const call = hydrateRoot.mock.calls[0] as unknown as [
		{ attrs: Record<string, string> },
		React.ReactElement,
	];
	// call = [marker, ReactElement]
	expect(call[0].attrs["data-island"]).toBe("counter");
	expect(call[1].type).toBe(Counter);
	expect((call[1].props as { start: number }).start).toBe(7);
});

test("misspelled island logs error, does not throw, other islands still hydrate", async () => {
	const hydrateRoot = mock(() => ({ unmount() {}, render() {} }));
	mock.module("react-dom/client", () => ({ hydrateRoot }));

	const errSpy = mock(() => {});
	const origErr = console.error;
	console.error = errSpy;

	try {
		(globalThis as { document: unknown }).document = buildFakeDom([
			{ name: "missing-name", props: {} },
			{ name: "counter", props: { start: 1 } },
		]);

		const { createClient } = await import(
			`../../src/client/index.ts?t=${Date.now()}`
		);
		const client = createClient();
		const Counter = () =>
			React.createElement("button", { type: "button" }, "x");
		client.register("counter", Counter);

		expect(() => client.hydrateAll()).not.toThrow();
		expect(hydrateRoot).toHaveBeenCalledTimes(1);
		expect(errSpy).toHaveBeenCalled();
		const msg = (errSpy.mock.calls[0] as unknown as unknown[]).join(" ");
		expect(msg).toContain("unknown island");
		expect(msg).toContain("missing-name");
	} finally {
		console.error = origErr;
	}
});

// --- <Island> SSR markup ---

test("<Island> emits data-island marker followed by JSON props blob", () => {
	const Counter = (props: { start: number }) =>
		React.createElement("button", { type: "button" }, `count: ${props.start}`);

	const html = renderToStaticMarkup(
		React.createElement(
			Island,
			{ name: "counter", props: { start: 3 } },
			React.createElement(Counter, { start: 3 }),
		),
	);

	// React serializes boolean-ish JSX attrs as `data-props="true"`. Browser
	// CSS selectors with `[data-props]` still match — the runtime checks
	// attribute presence, not value.
	expect(html).toBe(
		`<div data-island="counter"><button type="button">count: 3</button></div>` +
			`<script type="application/json" data-props="true" data-for="counter">{"start":3}</script>`,
	);
});

test("<Island> escapes '</script>' inside string props so the script tag cannot be terminated early", () => {
	const html = renderToStaticMarkup(
		React.createElement(Island, {
			name: "x",
			props: { html: "</script><img onerror=alert(1)>" },
		}),
	);
	// React's renderer recognizes script content and escapes the 's' in </script>
	// to s. The browser HTML parser sees `</script>` as literal text
	// (no closing tag), so the inner </script> can't break out. The literal
	// </script> sequence must not appear inside the blob.
	const open = html.indexOf("<script");
	const close = html.indexOf("</script>", open);
	const blob = html.slice(html.indexOf(">", open) + 1, close);
	expect(blob).not.toContain("</script>");
	// After JSON.parse, the original string round-trips back intact.
	expect(JSON.parse(blob)).toEqual({ html: "</script><img onerror=alert(1)>" });
});

// --- Multi-island build: shared React runtime chunk ---

test("multi-island build emits a single shared React runtime chunk", async () => {
	const outDir = await makeOut();

	const res = await build({
		appDir: join(FIXTURES, "multi-island-app/app"),
		outDir,
		target: "bun",
		mode: "production",
	});

	expect(res.clientManifest.entry).toBeString();
	expect(res.clientManifest.islands.alpha).toBeString();
	expect(res.clientManifest.islands.beta).toBeString();

	// Acceptance: "A page with multiple islands shares a single React runtime
	// chunk." Bun.build with a single synthetic entrypoint puts everything in
	// one chunk, so the shared-runtime property is satisfied by-construction:
	// React must appear exactly once across all emitted chunks.
	const glob = new Bun.Glob("**/*.js");
	const chunks: string[] = [];
	for await (const f of glob.scan({ cwd: `${outDir}/client`, onlyFiles: true }))
		chunks.push(f);
	expect(chunks.length).toBeGreaterThanOrEqual(1);

	let runtimeChunks = 0;
	for (const c of chunks) {
		const src = await Bun.file(`${outDir}/client/${c}`).text();
		// Marker strings present only in the actual React DOM runtime source.
		if (src.includes("react.dev") || src.includes("ReactDOMHydrationRoot"))
			runtimeChunks++;
	}
	expect(runtimeChunks).toBe(1);

	// Both islands must be addressable from the manifest.
	expect(res.clientManifest.islands.alpha).toBeString();
	expect(res.clientManifest.islands.beta).toBeString();
});

// --- Generated synthetic entry shape ---

test("generated client-entry imports patties/client and registers each island", async () => {
	const outDir = await makeOut();
	const appDir = join(FIXTURES, "build-app/app");

	await build({ appDir, outDir, target: "bun", mode: "production" });

	const generated = await Bun.file(
		`${appDir}/patties-gen/client-entry.ts`,
	).text();
	expect(generated).toContain("createClient");
	expect(generated).toContain("/client/index.ts");
	expect(generated).toContain(`client.register("counter"`);
	expect(generated).toContain("client.hydrateAll()");
});
