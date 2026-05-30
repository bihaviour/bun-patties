import type { BunRoutes, HTTPMethod, RouteEntry } from "../types.ts";
import { createAiContext } from "./context.ts";
import { listAgents } from "./registry.ts";
import type { AiContext } from "./types.ts";

// Wire opt-in agent triggers ("POST /api/booking/chat") into the Bun routes
// table. Filesystem routes always win; conflicts are logged.
export function registerAgentTriggers(
	routes: BunRoutes,
	entries: RouteEntry[],
): void {
	const conflicts = new Set<string>();
	for (const e of entries) {
		const mod = (e as RouteEntry & { __mod?: Record<string, unknown> }).__mod;
		if (e.kind === "api" && mod) {
			for (const m of [
				"GET",
				"POST",
				"PUT",
				"DELETE",
				"PATCH",
				"OPTIONS",
				"HEAD",
			] as HTTPMethod[]) {
				if (typeof mod[m] === "function") conflicts.add(`${m} ${e.bunPattern}`);
			}
		} else if (e.kind === "page") {
			conflicts.add(`GET ${e.bunPattern}`);
		}
	}

	// Without __mod we approximate: any route entry claims at least GET (pages)
	// or all-exported methods (api). Build emits __mod-less entries so be
	// conservative — treat *every* route file as claiming any method on its
	// pattern. This errs toward the spec rule: "filesystem route always wins".
	const conservativeConflicts = new Set<string>();
	for (const e of entries) conservativeConflicts.add(e.bunPattern);

	for (const a of listAgents()) {
		for (const trig of a.config.triggers ?? []) {
			const parsed = parseTrigger(trig);
			if (!parsed) {
				console.warn(
					`[patties] agent "${a.config.name}": invalid trigger "${trig}" (expected "METHOD /path").`,
				);
				continue;
			}
			const { method, path } = parsed;
			const key = `${method} ${path}`;
			if (conflicts.has(key) || conservativeConflicts.has(path)) {
				console.warn(
					`[patties] trigger conflict: agent "${a.config.name}" trigger "${trig}" overlaps a filesystem route. ` +
						`The filesystem route wins; trigger handler not registered.`,
				);
				continue;
			}
			const handler = makeTriggerHandler(a.config.name);
			attachTrigger(routes, path, method, handler);
		}
	}
}

function parseTrigger(t: string): { method: HTTPMethod; path: string } | null {
	const m = t.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s]*)$/);
	if (!m?.[1] || !m[2]) return null;
	return { method: m[1] as HTTPMethod, path: m[2] };
}

function makeTriggerHandler(agentName: string) {
	return async (
		req: Request & { params?: Record<string, string> },
	): Promise<Response> => {
		const { getAgent } = await import("./registry.ts");
		const agent = getAgent(agentName);
		const body = (await req.json().catch(() => ({}))) as Record<
			string,
			unknown
		>;
		const message = typeof body.message === "string" ? body.message : "";
		const ctx: AiContext = createAiContext({ signal: req.signal });
		try {
			const result = await agent.run({ message, ...body }, ctx);
			return new Response(result.stream, {
				headers: { "Content-Type": "text/event-stream" },
			});
		} catch (err) {
			const e = err as { name?: string; issues?: unknown; message?: string };
			if (e.name === "ToolInputInvalid") {
				return new Response(
					JSON.stringify({ error: "ToolInputInvalid", issues: e.issues }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			throw err;
		}
	};
}

function attachTrigger(
	routes: BunRoutes,
	pattern: string,
	method: HTTPMethod,
	handler: (
		req: Request & { params?: Record<string, string> },
	) => Promise<Response>,
): void {
	const existing = routes[pattern];
	const wrapped = { [method]: handler } as Record<string, typeof handler>;
	if (
		existing &&
		typeof existing === "object" &&
		!(existing instanceof Response)
	) {
		routes[pattern] = {
			...(existing as object),
			...wrapped,
		} as (typeof routes)[string];
	} else {
		routes[pattern] = wrapped as (typeof routes)[string];
	}
}
