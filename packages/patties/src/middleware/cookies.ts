import type { PattiesContext } from "./index.ts";

// Collect Set-Cookie header values from a mutated Bun.CookieMap.
// Bun.CookieMap exposes toSetCookieHeaders() (per the bun-cookies RFC).
// We probe at runtime and return [] if the shape differs.
export function collectSetCookieHeaders(cookies: unknown): string[] {
	if (!cookies || typeof cookies !== "object") return [];
	const anyCookies = cookies as { toSetCookieHeaders?: () => string[] };
	if (typeof anyCookies.toSetCookieHeaders === "function") {
		return anyCookies.toSetCookieHeaders();
	}
	return [];
}

// Wall-clock millisecond reading. Prefer Bun.nanoseconds() on Bun; fall back to
// performance.now() on non-Bun targets. Both yield double-precision ms.
export function now(): number {
	const bun = (globalThis as { Bun?: { nanoseconds?: () => number | bigint } })
		.Bun;
	if (bun && typeof bun.nanoseconds === "function") {
		return Number(bun.nanoseconds()) / 1e6;
	}
	return performance.now();
}

function isProduction(): boolean {
	const env = (typeof Bun !== "undefined" ? Bun.env : process.env) as Record<
		string,
		string | undefined
	>;
	return env.NODE_ENV === "production";
}

// The response finalizer: flushes Set-Cookie headers, echoes the request id as
// X-Request-Id, and (in dev only) emits Server-Timing. Handler-set X-Request-Id
// and Server-Timing headers are never overwritten.
export function finalizeResponse(
	res: Response,
	ctx: PattiesContext,
	opts: { startMs: number },
): Response {
	const cookieValues = collectSetCookieHeaders(ctx.cookies);
	const headers = new Headers(res.headers);

	for (const v of cookieValues) headers.append("Set-Cookie", v);

	if (!headers.has("X-Request-Id")) {
		headers.set("X-Request-Id", ctx.requestId);
	}

	if (!isProduction() && !headers.has("Server-Timing")) {
		const ms = now() - opts.startMs;
		headers.set("Server-Timing", `total;dur=${ms.toFixed(1)}`);
	}

	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers,
	});
}
