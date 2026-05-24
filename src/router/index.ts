import { appendCookieHeaders } from "../middleware/cookies.ts";
import { compose, type Middleware, makeContext } from "../middleware/index.ts";
import type { Renderer } from "../render/index.tsx";
import type { BunRoutes, Handler, HTTPMethod, RouteEntry } from "../types.ts";
import { HTTP_METHODS } from "../types.ts";

export interface Plugin {
	name: string;
	middleware?: Middleware;
	setup?: (api: {
		route: (
			pattern: string,
			handlers: Partial<Record<HTTPMethod, Handler>>,
		) => void;
	}) => void | Promise<void>;
}

export interface RouterOptions {
	appDir: string;
	middleware?: Middleware;
	plugins?: Plugin[];
	renderer: Renderer;
	// Pre-scanned route table. When provided, skips runtime scanRoutes().
	entries?: RouteEntry[];
	// Pre-imported route modules keyed by entry.filePath. When provided, used instead of `await import(entry.filePath)`.
	modules?: Record<string, unknown>;
}

export interface CompiledRouter {
	routes: BunRoutes;
	fallback: (req: Request) => Promise<Response>;
	entries: RouteEntry[];
}

export async function createRouter(
	options: RouterOptions,
): Promise<CompiledRouter> {
	const { appDir } = options;

	const userMiddleware =
		options.middleware ?? (await loadAppMiddleware(appDir));

	let entries = options.entries;
	if (!entries) {
		// Static import — fine for dev paths. The build pipeline (which always
		// pre-scans) bypasses this function entirely via createCompiledRouter().
		const { scanRoutes } = await import("./filesystem.ts");
		entries = await scanRoutes(appDir);
	}

	return createCompiledRouter({
		entries,
		middleware: userMiddleware,
		plugins: options.plugins,
		renderer: options.renderer,
		modules: options.modules,
	});
}

export interface CompiledRouterOptions {
	entries: RouteEntry[];
	middleware?: Middleware;
	plugins?: Plugin[];
	renderer: Renderer;
	modules?: Record<string, unknown>;
}

// Pure routing assembly — no filesystem access. The build module's generated
// server entry imports this directly so `Bun.Glob` / `scanRoutes` never enter
// the production bundle.
export async function createCompiledRouter(
	options: CompiledRouterOptions,
): Promise<CompiledRouter> {
	const { entries, renderer } = options;
	const plugins = options.plugins ?? [];
	const middlewareChain: Middleware[] = [];
	if (options.middleware) middlewareChain.push(options.middleware);
	for (const p of plugins) {
		if (p.middleware) middlewareChain.push(p.middleware);
	}
	const preloadedModules = options.modules;
	const routes: BunRoutes = {};

	for (const entry of entries) {
		if (entry.kind === "page") {
			const handler: Handler = (req, ctx) =>
				renderer.renderPage(entry, req, ctx);
			attach(routes, entry.bunPattern, { GET: wrap(handler, middlewareChain) });
		} else {
			const mod = (preloadedModules?.[entry.filePath] ??
				(await import(entry.filePath))) as Record<string, unknown>;
			if (typeof mod.default === "function") {
				throw new Error(
					`API route ${entry.filePath} must not default-export a handler. ` +
						`Export named GET/POST/PUT/DELETE/PATCH/OPTIONS/HEAD instead.`,
				);
			}
			const methodMap: Partial<Record<HTTPMethod, Handler>> = {};
			let found = 0;
			for (const m of HTTP_METHODS) {
				const fn = mod[m];
				if (typeof fn === "function") {
					methodMap[m] = wrap(fn as Handler, middlewareChain);
					found++;
				}
			}
			if (found === 0) {
				throw new Error(
					`API route ${entry.filePath} exports no HTTP-method handlers ` +
						`(GET/POST/PUT/DELETE/PATCH/OPTIONS/HEAD).`,
				);
			}
			attach(routes, entry.bunPattern, methodMap);
		}
	}

	for (const p of plugins) {
		if (!p.setup) continue;
		await p.setup({
			route(pattern, handlers) {
				const wrapped: Partial<Record<HTTPMethod, Handler>> = {};
				for (const [m, h] of Object.entries(handlers) as [
					HTTPMethod,
					Handler,
				][]) {
					wrapped[m] = wrap(h, middlewareChain);
				}
				attach(routes, pattern, wrapped);
			},
		});
	}

	const fallback = wrap(
		() => new Response("Not Found", { status: 404 }),
		middlewareChain,
	);

	return {
		routes,
		fallback: async (req: Request) => {
			const ctx = makeContext(req);
			const res = await fallback(req, ctx);
			return appendCookieHeaders(res, ctx.cookies);
		},
		entries,
	};
}

function attach(
	routes: BunRoutes,
	pattern: string,
	methodMap: Partial<Record<HTTPMethod, Handler>>,
): void {
	const existing = routes[pattern];
	const bunWrapped: Record<
		string,
		(req: Request & { params: Record<string, string> }) => Promise<Response>
	> = {};
	for (const [m, h] of Object.entries(methodMap)) {
		if (!h) continue;
		bunWrapped[m] = (req) => {
			const params = req.params ?? {};
			const ctx = makeContext(req, params);
			return Promise.resolve(h(req, ctx)).then((res) =>
				appendCookieHeaders(res, ctx.cookies),
			);
		};
	}
	if (
		existing &&
		typeof existing === "object" &&
		!(existing instanceof Response)
	) {
		routes[pattern] = {
			...(existing as object),
			...bunWrapped,
		} as (typeof routes)[string];
	} else {
		routes[pattern] = bunWrapped as (typeof routes)[string];
	}
}

function wrap(handler: Handler, mws: Middleware[]): Handler {
	if (mws.length === 0) return handler;
	return compose(mws, handler);
}

async function loadAppMiddleware(
	appDir: string,
): Promise<Middleware | undefined> {
	const path = appDir.replace(/\/+$/, "") + "/middleware.ts";
	const exists = await Bun.file(path).exists();
	if (!exists) return undefined;
	const mod = (await import(path)) as { default?: unknown };
	const fn = mod.default;
	if (fn === undefined) return undefined;
	if (typeof fn !== "function") {
		throw new Error(
			`${path}: default export must be a Middleware function (got ${typeof fn}).`,
		);
	}
	return fn as Middleware;
}
