import { networkInterfaces } from "node:os";
import type { DevServer } from "../dev/watcher.ts";
import { handleOpenInEditor } from "../internal/open-in-editor.ts";
import { compilePatterns, dispatch } from "../router/match.ts";
import type { BunRoutes } from "../types.ts";

export interface ServerOptions {
	port?: number;
	hostname?: string;
	unix?: string;
	reusePort?: boolean;
	routes: BunRoutes;
	fallback: (req: Request) => Response | Promise<Response>;
	dev?: boolean;
	devServer?: DevServer;
	staticRoutes?: Record<string, Response>;
	/** Suppress the bound-URL log line; the caller will print its own banner. */
	quiet?: boolean;
}

export interface ServerHandle {
	fetch: (req: Request) => Promise<Response>;
	port: number;
}

// Build the routes table Bun.serve will receive (including dev-only internals).
function buildRoutes(opts: ServerOptions): BunRoutes {
	const routes: BunRoutes = { ...(opts.staticRoutes ?? {}), ...opts.routes };
	if (opts.dev) {
		routes["/__patties_open"] = ((req: Request) =>
			handleOpenInEditor(req)) as unknown as (typeof routes)[string];
		if (opts.devServer) {
			// Real upgrade path: attempt WS upgrade, otherwise fall back to the dev
			// server's `fetch` (a 426 message).
			const dev = opts.devServer;
			routes["/__patties_hmr"] = ((req: Request, server: unknown) => {
				const s = server as { upgrade?: (r: Request) => boolean } | undefined;
				if (s && typeof s.upgrade === "function" && s.upgrade(req))
					return undefined;
				return dev.fetch(req);
			}) as unknown as (typeof routes)[string];
		} else {
			routes["/__patties_hmr"] = (() =>
				new Response("HMR upgrade requires a real Bun.serve instance", {
					status: 426,
				})) as unknown as (typeof routes)[string];
		}
	}
	return routes;
}

function validate(opts: ServerOptions): void {
	if (!opts.routes) throw new Error("createServer: `routes` is required");
	if (opts.unix && (opts.port !== undefined || opts.hostname !== undefined)) {
		throw new Error(
			"createServer: `unix` is mutually exclusive with `port`/`hostname`",
		);
	}
}

// Lightweight in-process fetch: matches a request against the routes table
// using simple path matching (`:param` and `*` catch-all). Used in tests and
// when callers want a `fetch(req)` they can drive without binding a port.
// In production `startServer()` should be used so Bun's native matcher handles
// dispatch.
export function createServer(opts: ServerOptions): ServerHandle {
	validate(opts);
	const routes = buildRoutes(opts);
	const compiled = compilePatterns(routes);
	const port = opts.port ?? 3000;

	const fetch = async (req: Request): Promise<Response> => {
		const hit = await dispatch(routes, req, {}, compiled);
		if (hit) return hit;
		return Promise.resolve(opts.fallback(req));
	};

	return { fetch, port };
}

export function startServer(opts: ServerOptions) {
	validate(opts);
	let routes = buildRoutes(opts);
	if (opts.dev) {
		routes = wrapRoutesForDevLogging(routes);
	}

	const userFallback = opts.fallback;
	const fallback = opts.dev
		? async (req: Request): Promise<Response> => {
				const t0 = performance.now();
				const res = await userFallback(req);
				logDevRequest(req, res.status, performance.now() - t0);
				return res;
			}
		: (req: Request) => Promise.resolve(userFallback(req));

	const serverOptions: Record<string, unknown> = {
		routes,
		fetch: fallback,
		reusePort: opts.reusePort,
	};
	if (opts.devServer) {
		serverOptions.websocket = opts.devServer.websocket;
	}
	if (opts.unix) {
		serverOptions.unix = opts.unix;
	} else {
		serverOptions.port = opts.port ?? 3000;
		serverOptions.hostname = opts.hostname ?? "0.0.0.0";
	}

	// Bun.serve's union of overload types is hard to satisfy generically; cast to any.
	const server = Bun.serve(
		serverOptions as unknown as Parameters<typeof Bun.serve>[0],
	);
	if (opts.devServer) {
		opts.devServer.attachServer(
			server as unknown as { publish: (t: string, d: string) => number },
		);
	}
	if (!opts.quiet) {
		printBoundBanner(
			opts,
			server as unknown as { hostname: string; port: number },
		);
	}
	return server;
}

// ──────────────────────────────────────────────────────────────────────────
// Dev-mode logging helpers.
//
// In dev we wrap every route handler with a small middleware that prints
// `HH:MM:SS METHOD path STATUS Xms`. Internal `/__patties_*` endpoints are
// suppressed (they're noisy WS pings + editor-open beacons). Static `Response`
// route values are passed through unwrapped — they can't be cleanly observed
// without consuming/cloning the body, and the cost isn't worth it.

const DEV_SKIP = /^\/__patties_/;

function logDevRequest(req: Request, status: number, ms: number): void {
	const path = new URL(req.url).pathname;
	if (DEV_SKIP.test(path)) return;
	const time = new Date().toTimeString().slice(0, 8);
	const stream = process.stdout as NodeJS.WriteStream;
	const tty = Boolean(stream.isTTY) && !process.env.NO_COLOR;
	const dim = (s: string) => (tty ? `\x1b[2m${s}\x1b[0m` : s);
	const color =
		status >= 500
			? (s: string) => (tty ? `\x1b[31m${s}\x1b[0m` : s)
			: status >= 400
				? (s: string) => (tty ? `\x1b[33m${s}\x1b[0m` : s)
				: (s: string) => (tty ? `\x1b[32m${s}\x1b[0m` : s);
	stream.write(
		`${dim(time)} ${req.method} ${path} ${color(String(status))} ${dim(`${ms.toFixed(1)}ms`)}\n`,
	);
}

// Route handlers can return undefined (e.g. WS upgrade path) — accept that.
type AnyHandler = (
	req: Request & { params: Record<string, string> },
	server: unknown,
) => Response | undefined | Promise<Response | undefined>;

function wrapHandler(fn: AnyHandler): AnyHandler {
	return async (req, server) => {
		const t0 = performance.now();
		const out = await fn(req, server);
		if (out instanceof Response) {
			logDevRequest(req, out.status, performance.now() - t0);
		}
		return out;
	};
}

function wrapRoutesForDevLogging(routes: BunRoutes): BunRoutes {
	const out: BunRoutes = {};
	for (const [path, value] of Object.entries(routes)) {
		if (typeof value === "function") {
			out[path] = wrapHandler(
				value as AnyHandler,
			) as unknown as BunRoutes[string];
		} else if (
			value &&
			typeof value === "object" &&
			!(value instanceof Response)
		) {
			const wrapped: Record<string, AnyHandler> = {};
			for (const [method, h] of Object.entries(value)) {
				if (typeof h === "function") {
					wrapped[method] = wrapHandler(h as AnyHandler);
				}
			}
			out[path] = wrapped as unknown as BunRoutes[string];
		} else {
			out[path] = value;
		}
	}
	return out;
}

function printBoundBanner(
	opts: ServerOptions,
	server: { hostname: string; port: number },
): void {
	if (opts.unix) {
		console.log(`[patties] listening on unix://${opts.unix}`);
		return;
	}
	const port = server.port;
	const stream = process.stdout as NodeJS.WriteStream;
	const tty = Boolean(stream.isTTY) && !process.env.NO_COLOR;
	const dim = (s: string) => (tty ? `\x1b[2m${s}\x1b[0m` : s);
	const cyan = (s: string) => (tty ? `\x1b[36m${s}\x1b[0m` : s);
	const isAllInterfaces =
		server.hostname === "0.0.0.0" || server.hostname === "::";
	stream.write(`  ${dim("➜")}  Local:   ${cyan(`http://localhost:${port}`)}\n`);
	if (isAllInterfaces) {
		const lan = findLanIp();
		if (lan) {
			stream.write(
				`  ${dim("➜")}  Network: ${cyan(`http://${lan}:${port}`)}\n`,
			);
		} else {
			stream.write(`  ${dim("➜")}  Network: ${dim("(no LAN interface)")}\n`);
		}
	} else if (
		server.hostname !== "localhost" &&
		server.hostname !== "127.0.0.1"
	) {
		stream.write(
			`  ${dim("➜")}  Network: ${cyan(`http://${server.hostname}:${port}`)}\n`,
		);
	}
}

function findLanIp(): string | null {
	try {
		const nets = networkInterfaces();
		for (const list of Object.values(nets)) {
			for (const ni of list ?? []) {
				if (ni.family === "IPv4" && !ni.internal) return ni.address;
			}
		}
	} catch {}
	return null;
}
