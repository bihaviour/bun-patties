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
	const routes = buildRoutes(opts);

	const serverOptions: Record<string, unknown> = {
		routes,
		fetch: (req: Request) => Promise.resolve(opts.fallback(req)),
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
	const bound = opts.unix
		? `unix://${opts.unix}`
		: `http://${server.hostname}:${server.port}`;
	console.log(`[patties] listening on ${bound}`);
	return server;
}
