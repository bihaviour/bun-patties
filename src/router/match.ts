import type { BunRoutes } from "../types.ts";

// Shared route matcher. Implements the same `:param` / `*` catch-all semantics
// as Bun.serve's native router so the in-process `createServer` and the
// edge-target's generated worker boot dispatch identically.

export interface Compiled {
	pattern: string;
	match: (path: string) => Record<string, string> | null;
}

export function makeMatcher(
	pattern: string,
): (path: string) => Record<string, string> | null {
	const segs = pattern.split("/").filter(Boolean);
	return (path) => {
		const parts = path.split("/").filter(Boolean);
		const params: Record<string, string> = {};
		let i = 0;
		for (; i < segs.length; i++) {
			const s = segs[i]!;
			if (s === "*") {
				params["*"] = parts.slice(i).join("/");
				return params;
			}
			const p = parts[i];
			if (p === undefined) return null;
			if (s.startsWith(":")) {
				params[s.slice(1)] = decodeURIComponent(p);
				continue;
			}
			if (s !== p) return null;
		}
		if (i !== parts.length) return null;
		return params;
	};
}

export function compilePatterns(routes: BunRoutes): Compiled[] {
	return Object.keys(routes).map((pattern) => ({
		pattern,
		match: makeMatcher(pattern),
	}));
}

export interface DispatchExtras {
	env?: unknown;
	execCtx?: unknown;
}

// Returns a Response on hit; null on miss so the caller can apply a fallback.
// `compiled` is optional — pass a pre-compiled list to avoid re-walking the
// route map on every request when the route table is stable.
export async function dispatch(
	routes: BunRoutes,
	req: Request,
	extras: DispatchExtras = {},
	compiled?: Compiled[],
): Promise<Response | null> {
	const url = new URL(req.url);
	const list = compiled ?? compilePatterns(routes);
	for (const c of list) {
		const params = c.match(url.pathname);
		if (!params) continue;
		const value = routes[c.pattern];
		if (value instanceof Response) return value.clone();
		const augmented = Object.assign(req, {
			params,
			env: extras.env,
			execCtx: extras.execCtx,
		});
		if (typeof value === "function") {
			return await (
				value as (
					r: Request & { params: Record<string, string> },
				) => Response | Promise<Response>
			)(augmented);
		}
		const methodHandler = (value as Record<string, unknown>)[req.method];
		if (typeof methodHandler === "function") {
			return await (
				methodHandler as (
					r: Request & { params: Record<string, string> },
				) => Response | Promise<Response>
			)(augmented);
		}
		return new Response("Method Not Allowed", { status: 405 });
	}
	return null;
}
