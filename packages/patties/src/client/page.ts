import type { ComponentType } from "react";
import * as React from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import {
	BOOTSTRAP_ID,
	type BootstrapPayload,
	bootstrapProps,
	NAV_HEADER,
	type NavPayload,
} from "../render/bootstrap.ts";

// biome-ignore lint/suspicious/noExplicitAny: page props are user-defined; the runtime only forwards them.
type PageComponent = ComponentType<any>;

// What a generated page entry hands the runtime: the page's default export plus
// its optional client-side `deserialize` hook. Server-only exports (`loader`,
// `serialize`) are stripped from the client bundle at build time.
export interface PageExports {
	Page: PageComponent;
	deserialize?: (data: unknown) => unknown;
}

export interface HydratePageOptions {
	root?: string;
	bootstrap?: string;
	deserialize?: (data: unknown) => unknown;
}

// Module state is shared by every page entry because all page bundles come from
// one `Bun.build` call with code splitting — this file lands in a shared chunk.
const pages: Record<string, PageExports> = {};
let reactRoot: Root | null = null;
let currentRoute: string | null = null;
let navSeq = 0;
const navCache = new Map<string, Promise<NavPayload | null>>();
// Page chunks are only ever served from here (build/index.ts PUBLIC_PREFIX).
const CHUNK_PREFIX = "/_patties/client/";

function readBootstrap(selector: string): BootstrapPayload {
	const raw = document.querySelector(selector)?.textContent || "{}";
	try {
		const parsed = JSON.parse(raw) as Partial<BootstrapPayload>;
		return { ...parsed, params: parsed.params ?? {} };
	} catch (e) {
		console.error("[patties] bootstrap payload parse failed:", e);
		return { params: {} };
	}
}

// Hydrate the page subtree under `#root` with the props the server rendered.
// `<head>`, the bootstrap blob, and the module script sit outside the root.
export function hydratePage(
	Page: PageComponent,
	options: HydratePageOptions = {},
): Root | null {
	const el = document.querySelector(options.root ?? "#root");
	if (!el) {
		console.error("[patties] hydratePage: root element not found");
		return null;
	}
	const payload = readBootstrap(options.bootstrap ?? `#${BOOTSTRAP_ID}`);
	const props = bootstrapProps(payload, options.deserialize);
	return hydrateRoot(el, React.createElement(Page, props));
}

// Called by every generated page entry. The first call on a document hydrates;
// later calls (a chunk loaded by `navigate`) only register the page.
export function bootPage(route: string, exports: PageExports): void {
	pages[route] = exports;
	if (reactRoot) return;
	const start = () => {
		if (reactRoot) return;
		const el = document.getElementById("root");
		if (!el) {
			console.error("[patties] bootPage: #root not found");
			return;
		}
		const payload = readBootstrap(`#${BOOTSTRAP_ID}`);
		const props = bootstrapProps(payload, exports.deserialize);
		reactRoot = hydrateRoot(
			el,
			React.createElement(exports.Page, { key: route, ...props }),
		);
		currentRoute = route;
		history.replaceState({ ...(history.state ?? {}), __patties: 1 }, "");
		window.addEventListener("popstate", onPopState);
	};
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, { once: true });
	} else {
		start();
	}
}

function onPopState(event: PopStateEvent): void {
	if (!(event.state as { __patties?: number } | null)?.__patties) return;
	void navigate(location.href, { history: "none", scroll: false });
}

// True when a client-side transition is possible: this document booted a
// hydrated page and the target is same-origin.
export function canSoftNavigate(href: string): boolean {
	if (!reactRoot || typeof location === "undefined") return false;
	try {
		return new URL(href, location.href).origin === location.origin;
	} catch {
		return false;
	}
}

function navKey(url: URL): string {
	return url.pathname + url.search;
}

async function fetchNav(url: URL): Promise<NavPayload | null> {
	const res = await fetch(url, {
		headers: { [NAV_HEADER]: "1" },
		credentials: "same-origin",
	});
	if (!res.ok) return null;
	// A redirect that left the origin is not ours to render: full load instead.
	if (res.url && new URL(res.url).origin !== location.origin) return null;
	if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
		return null;
	}
	const payload = (await res.json()) as NavPayload;
	if (payload.hydrated && !isTrustedChunk(payload.script)) return null;
	// Follow server-side redirects: the address bar should show the final URL.
	if (res.redirected && payload.hydrated) {
		(payload as NavPayload & { url?: string }).url = res.url;
	}
	return payload;
}

// The payload's `script` is import()ed, so it must be a same-origin framework
// chunk — never a URL an echoing JSON endpoint or a redirect could inject.
function isTrustedChunk(script: unknown): boolean {
	if (typeof script !== "string") return false;
	try {
		const u = new URL(script, location.href);
		return u.origin === location.origin && u.pathname.startsWith(CHUNK_PREFIX);
	} catch {
		return false;
	}
}

function loadNav(url: URL): Promise<NavPayload | null> {
	const key = navKey(url);
	let pending = navCache.get(key);
	if (!pending) {
		pending = fetchNav(url).catch(() => null);
		navCache.set(key, pending);
	}
	return pending;
}

async function loadPage(payload: NavPayload): Promise<PageExports | null> {
	if (!payload.hydrated) return null;
	const known = pages[payload.route];
	if (known) return known;
	await import(payload.script);
	return pages[payload.route] ?? null;
}

// Warm the nav payload and page chunk for `href` (e.g. on hover/focus).
export function prefetch(href: string): void {
	if (!canSoftNavigate(href)) return;
	const url = new URL(href, location.href);
	void loadNav(url).then((p) => (p ? loadPage(p).catch(() => null) : null));
}

export interface NavigateOptions {
	replace?: boolean;
	// "none" is used for back/forward, where the browser already moved history.
	history?: "push" | "replace" | "none";
	scroll?: boolean;
}

// Client-side transition for hydrated pages: fetch the route's bootstrap
// payload, load its page chunk, and re-render the shared root. Anything the
// runtime can't handle (non-hydrated target, error, cross-origin) falls back to
// a full document load so navigation always succeeds.
export async function navigate(
	href: string,
	options: NavigateOptions = {},
): Promise<void> {
	const url = new URL(href, location.href);
	if (!canSoftNavigate(url.href)) {
		location.assign(url.href);
		return;
	}
	const seq = ++navSeq;
	const mode = options.history ?? (options.replace ? "replace" : "push");
	// Pop navigations always refetch: the cached payload may be stale.
	if (mode === "none") navCache.delete(navKey(url));
	const payload = await loadNav(url);
	navCache.delete(navKey(url));
	if (seq !== navSeq) return;
	if (!payload?.hydrated) {
		location.assign(url.href);
		return;
	}
	let exports: PageExports | null = null;
	try {
		exports = await loadPage(payload);
	} catch (e) {
		console.error("[patties] failed to load page chunk:", e);
	}
	if (seq !== navSeq) return;
	if (!exports || !reactRoot) {
		location.assign(url.href);
		return;
	}
	const finalUrl = (payload as { url?: string }).url ?? url.href;
	if (mode === "push") history.pushState({ __patties: 1 }, "", finalUrl);
	else if (mode === "replace")
		history.replaceState({ __patties: 1 }, "", finalUrl);
	if (payload.title !== undefined) document.title = payload.title;
	const props = bootstrapProps(payload.bootstrap, exports.deserialize);
	// Keyed by route so moving between routes remounts, while a param change
	// within one route keeps component state — matching a full reload's identity.
	reactRoot.render(
		React.createElement(exports.Page, { key: payload.route, ...props }),
	);
	currentRoute = payload.route;
	if (options.scroll !== false) {
		const hash = new URL(finalUrl).hash;
		const target = hash ? document.getElementById(hash.slice(1)) : null;
		if (target) target.scrollIntoView();
		else window.scrollTo(0, 0);
	}
}

// Route pattern of the page currently mounted, or null before boot.
export function getCurrentRoute(): string | null {
	return currentRoute;
}

// Unmount the page root and forget registered pages, returning the runtime to
// its pre-boot state. For tests and hosts that swap documents in place.
export function resetPageRuntime(): void {
	reactRoot?.unmount();
	reactRoot = null;
	currentRoute = null;
	navCache.clear();
	for (const k of Object.keys(pages)) delete pages[k];
	if (typeof window !== "undefined") {
		window.removeEventListener("popstate", onPopState);
	}
}
