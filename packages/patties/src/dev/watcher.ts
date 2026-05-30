// Dev / HMR server module (spec 05).
//
// The dev runtime is `bun --hot` (or `bun --watch` via `patties dev --cold`).
// This module owns the WebSocket endpoint at `/__patties_hmr` and the
// publish channel that tells connected browsers to reload or re-hydrate.
//
// We rely on Bun's native primitives:
//   - WebSocket pub/sub topics manage the subscriber set; we never hold a
//     `Set<ServerWebSocket>` ourselves and dead sockets are pruned on close.
//   - `bun --hot` keeps `Bun.serve` (and these WebSockets) alive across
//     module reloads, so reconnect logic on the client is only exercised
//     under `--cold`.

type AnyServer = {
	publish: (topic: string, data: string) => number;
};

type AnyWS = {
	subscribe: (topic: string) => void;
	send: (data: string) => void;
};

export interface WebSocketHandler {
	open?: (ws: AnyWS) => void;
	message?: (ws: AnyWS, data: string | ArrayBufferLike) => void;
	close?: (ws: AnyWS, code: number, reason: string) => void;
}

export interface DevServer {
	/** Fallback HTTP response when a non-WS request hits the HMR endpoint. */
	fetch: (req: Request) => Response | Promise<Response>;
	/** Bun.serve `websocket` handler. */
	websocket: WebSocketHandler;
	/** Publish an update for the given filesystem path. */
	notifyChange(path: string): void;
	/** Called by `startServer` once `Bun.serve` returns the live server. */
	attachServer(server: AnyServer): void;
}

export interface DevOptions {
	/** Absolute path to the user's `app/` directory; used to classify changes. */
	appDir: string;
}

const HMR_TOPIC = "hmr";
const RELOAD_MSG = JSON.stringify({ type: "reload" });
// Per-process id so reconnecting clients can tell "same server, transient
// disconnect" (no reload) from "server restarted, reload". Survives `bun --hot`
// module reloads (same process); changes on `--cold` / full restart.
const SERVER_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const HELLO_MSG = JSON.stringify({ type: "hello", serverId: SERVER_ID });

export function createDevServer(options: DevOptions): DevServer {
	let server: AnyServer | null = null;
	const islandsDir = `${options.appDir.replace(/\/+$/, "")}/islands/`;

	const publish = (msg: string): void => {
		if (!server) return;
		server.publish(HMR_TOPIC, msg);
	};

	const notifyChange = (path: string): void => {
		if (path.startsWith(islandsDir)) {
			const rel = path.slice(islandsDir.length);
			const name = rel.replace(/\.[tj]sx?$/, "").replace(/\//g, "-");
			publish(JSON.stringify({ type: "update", island: name }));
			return;
		}
		publish(RELOAD_MSG);
	};

	const websocket: WebSocketHandler = {
		open(ws) {
			ws.subscribe(HMR_TOPIC);
			ws.send(HELLO_MSG);
		},
	};

	const fetch = (_req: Request): Response =>
		new Response("Expected WebSocket upgrade", { status: 426 });

	return {
		fetch,
		websocket,
		notifyChange,
		attachServer(s) {
			server = s;
		},
	};
}
