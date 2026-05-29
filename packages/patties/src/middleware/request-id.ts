// Request-id generation + inbound validation, shared by the request composer
// (makeContext) and the AI context. UUIDv7 on Bun (time-ordered), UUIDv4 on
// non-Bun targets (edge / workerd) — best-effort time-ordering across targets.

// Allowlist for an inbound X-Request-Id we are willing to echo back. Keeps
// control characters and oversize payloads out of log lines.
export const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;

export function generateRequestId(): string {
	const bun = (globalThis as { Bun?: { randomUUIDv7?: () => string } }).Bun;
	if (bun && typeof bun.randomUUIDv7 === "function") return bun.randomUUIDv7();
	if (typeof crypto !== "undefined" && "randomUUID" in crypto)
		return crypto.randomUUID();
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Echo a well-shaped inbound id from an upstream proxy; otherwise mint a fresh
// one. Inbound values that fail the allowlist are ignored, not echoed.
export function resolveRequestId(req: Request): string {
	const inbound = req.headers.get("x-request-id");
	return inbound && REQUEST_ID_RE.test(inbound) ? inbound : generateRequestId();
}
