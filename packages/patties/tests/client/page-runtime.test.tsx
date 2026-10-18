import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { join } from "node:path";
import { act } from "react";
import { NAV_HEADER } from "../../src/render/bootstrap.ts";
import { createRenderer } from "../../src/render/index.tsx";
import { createRouter } from "../../src/router/index.ts";

const APP = join(import.meta.dir, "..", "fixtures", "hydrate-app", "app");
const MANIFEST = {
	entry: null,
	islands: {},
	pages: {
		"/": "/_patties/client/home.js",
		"/users/:id": "/_patties/client/u.js",
	},
};

let registered = false;
const errors: string[] = [];
const originalError = console.error;

beforeAll(async () => {
	// Drive React through act(): another file may have torn down a happy-dom
	// window that React's scheduler captured, so scheduled work can't be trusted
	// to flush on its own.
	(
		globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	if (typeof document === "undefined") {
		const { GlobalRegistrator } = await import("@happy-dom/global-registrator");
		GlobalRegistrator.register({ url: "http://localhost/" });
		registered = true;
	}
	console.error = (...args: unknown[]) => {
		const msg = args.map(String).join(" ");
		// SSR and hydration share one JS realm here, so React's dev build sees
		// two renderers on the same context object. A browser never does.
		if (msg.includes("multiple renderers concurrently")) return;
		errors.push(msg);
	};
});

afterAll(async () => {
	const { resetPageRuntime } = await import("../../src/client/page.ts");
	// Flush the unmount inside act(): React would otherwise schedule its
	// cleanup for after happy-dom is torn down below.
	await act(async () => {
		resetPageRuntime();
	});
	console.error = originalError;
	if (registered) {
		const { GlobalRegistrator } = await import("@happy-dom/global-registrator");
		await GlobalRegistrator.unregister();
	}
});

// Drive the real renderer + router for one route, as the server would.
async function serve(
	path: string,
	pattern: string,
	params: Record<string, string> = {},
	headers: Record<string, string> = {},
): Promise<Response> {
	const renderer = createRenderer({ manifest: MANIFEST });
	const router = await createRouter({ appDir: APP, renderer });
	const route = router.routes[pattern] as Record<
		string,
		(r: Request) => Promise<Response>
	>;
	const get = route.GET;
	if (!get) throw new Error(`no GET for ${pattern}`);
	const req = new Request(`http://localhost${path}`, { headers });
	return get(Object.assign(req, { params }));
}

test("whole-tree hydration: no mismatch, context + function props work, Link soft-navigates", async () => {
	const html = await (await serve("/", "/")).text();
	const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? "";
	// The module script is what a browser would load; the test boots the page
	// directly instead.
	document.body.innerHTML = body.replace(
		/<script type="module"[^>]*><\/script>/,
		"",
	);

	const home = await import(join(APP, "routes", "index.tsx"));
	const user = await import(join(APP, "routes", "users", "[id].tsx"));
	const { bootPage, getCurrentRoute } = await import(
		"../../src/client/page.ts"
	);

	await act(async () => {
		bootPage("/", { Page: home.default, deserialize: home.deserialize });
	});
	expect(errors).toEqual([]);
	expect(getCurrentRoute()).toBe("/");

	const root = document.getElementById("root") as HTMLElement;
	expect(root.querySelector("#at")?.textContent).toBe("2026");
	const button = root.querySelector("button") as HTMLButtonElement;
	expect(button.textContent).toBe("count: 3");
	await act(async () => {
		button.click();
	});
	expect(button.textContent).toBe("count: 4");

	// Register the target page as if its chunk had already loaded.
	bootPage("/users/:id", { Page: user.default });

	const seen: Array<string | null> = [];
	const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
		_input: unknown,
		init?: RequestInit,
	) => {
		const nav = new Headers(init?.headers).get(NAV_HEADER);
		seen.push(nav);
		return serve(
			"/users/7",
			"/users/:id",
			{ id: "7" },
			{ [NAV_HEADER]: nav ?? "" },
		);
	}) as typeof fetch);

	const link = root.querySelector('a[href="/users/7"]') as HTMLAnchorElement;
	await act(async () => {
		link.dispatchEvent(
			new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
		);
		for (let i = 0; i < 50 && getCurrentRoute() !== "/users/:id"; i++) {
			await new Promise((r) => setTimeout(r, 5));
		}
	});
	fetchSpy.mockRestore();

	expect(seen).toEqual(["1"]);
	expect(getCurrentRoute()).toBe("/users/:id");
	expect(root.textContent).toBe("user 7");
	expect(location.pathname).toBe("/users/7");
	expect(document.title).toBe("User");
	expect(errors).toEqual([]);
});

test("navigation refuses payloads whose script is not a same-origin framework chunk", async () => {
	const { navigate } = await import("../../src/client/page.ts");
	const assign = spyOn(location, "assign").mockImplementation(() => {});
	const importSpy: string[] = [];
	for (const script of [
		"https://evil.example/x.js",
		"/api/upload/evil.js",
		"data:text/javascript,alert(1)",
	]) {
		const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async () =>
			Response.json({
				hydrated: true,
				route: "/evil",
				script,
				bootstrap: { params: {} },
			})) as unknown as typeof fetch);
		await act(async () => {
			await navigate(`/evil-${importSpy.length}`);
		});
		fetchSpy.mockRestore();
		importSpy.push(script);
	}
	// Every attempt fell back to a full document load, and none reached
	// import() (a failed import would log "failed to load page chunk").
	expect(assign).toHaveBeenCalledTimes(3);
	expect(errors.filter((e) => e.includes("page chunk"))).toEqual([]);
	assign.mockRestore();
});
