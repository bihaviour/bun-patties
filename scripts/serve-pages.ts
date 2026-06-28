#!/usr/bin/env bun
import { join, normalize } from "node:path";
/**
 * Static server for the Patties website + documentation under `pages/`.
 *
 * Bun-native: a plain `Bun.serve` that maps request paths to files on disk —
 * no build step, no framework, no dependencies. Powers `bun start` (serve) and
 * `bun run dev` (serve with `--hot` so edits to this file reload).
 *
 *   bun start            # serve pages/ on http://localhost:3000
 *   bun run dev          # same, with hot-reload of the server
 *   PORT=8080 bun start  # choose the port
 */
import { file } from "bun";

const ROOT = normalize(join(import.meta.dir, "..", "pages"));
const PORT = Number(process.env.PORT ?? 3000);

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8",
	".woff2": "font/woff2",
};

function contentType(path: string): string {
	const dot = path.lastIndexOf(".");
	return (
		(dot >= 0 && MIME[path.slice(dot).toLowerCase()]) ||
		"application/octet-stream"
	);
}

/** Resolve a URL pathname to a file inside ROOT, defending against traversal. */
async function resolve(pathname: string): Promise<string | null> {
	let rel = decodeURIComponent(pathname);
	if (rel.endsWith("/")) rel += "index.html";
	const abs = normalize(join(ROOT, rel));
	if (abs !== ROOT && !abs.startsWith(`${ROOT}/`)) return null; // escaped the root
	if (await file(abs).exists()) return abs;
	// Allow extensionless requests to map to `.html` (e.g. /docs/getting-started).
	if (!rel.includes(".") && (await file(`${abs}.html`).exists()))
		return `${abs}.html`;
	return null;
}

const server = Bun.serve({
	port: PORT,
	async fetch(req) {
		const { pathname } = new URL(req.url);
		const abs = await resolve(pathname === "/" ? "/index.html" : pathname);
		if (abs) {
			return new Response(file(abs), {
				headers: {
					"content-type": contentType(abs),
					"cache-control": "no-cache",
				},
			});
		}
		const notFound = await resolve("/404.html");
		if (notFound) {
			return new Response(file(notFound), {
				status: 404,
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}
		return new Response("404 — Not Found", {
			status: 404,
			headers: { "content-type": "text/plain" },
		});
	},
});

console.log(
	`patties site → http://localhost:${server.port}  (serving ${ROOT})`,
);
