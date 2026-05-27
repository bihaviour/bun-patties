import { describe, expect, mock, test } from "bun:test";
import { createDevServer } from "../../src/dev/watcher.ts";

function mkServer() {
	return { publish: mock<(topic: string, data: string) => number>(() => 1) };
}

function mkWS() {
	return {
		subscribe: mock<(topic: string) => void>(() => {}),
		send: mock<(data: string) => void>(() => {}),
	};
}

describe("createDevServer", () => {
	test("notifyChange under app/islands/ publishes update with island name", () => {
		const appDir = "/proj/app";
		const dev = createDevServer({ appDir });
		const server = mkServer();
		dev.attachServer(server);

		dev.notifyChange("/proj/app/islands/counter.tsx");
		expect(server.publish).toHaveBeenCalledWith(
			"hmr",
			JSON.stringify({ type: "update", island: "counter" }),
		);
	});

	test("notifyChange under nested island path uses dashed name", () => {
		const dev = createDevServer({ appDir: "/proj/app" });
		const server = mkServer();
		dev.attachServer(server);

		dev.notifyChange("/proj/app/islands/widgets/Counter.tsx");
		expect(server.publish).toHaveBeenCalledWith(
			"hmr",
			JSON.stringify({ type: "update", island: "widgets-Counter" }),
		);
	});

	test("notifyChange for non-island path publishes reload", () => {
		const dev = createDevServer({ appDir: "/proj/app" });
		const server = mkServer();
		dev.attachServer(server);

		dev.notifyChange("/proj/app/routes/index.tsx");
		expect(server.publish).toHaveBeenCalledWith(
			"hmr",
			JSON.stringify({ type: "reload" }),
		);
	});

	test("websocket.open subscribes to hmr topic and sends a hello with serverId", () => {
		const dev = createDevServer({ appDir: "/proj/app" });
		const ws = mkWS();
		dev.websocket.open?.(ws);
		expect(ws.subscribe).toHaveBeenCalledWith("hmr");
		const sent = (
			ws.send.mock.calls[0] as unknown as [string] | undefined
		)?.[0];
		expect(typeof sent).toBe("string");
		const msg = JSON.parse(sent as string) as {
			type: string;
			serverId: string;
		};
		expect(msg.type).toBe("hello");
		expect(typeof msg.serverId).toBe("string");
		expect(msg.serverId.length).toBeGreaterThan(0);
	});

	test("hello serverId is stable across opens within the same process", () => {
		const dev = createDevServer({ appDir: "/proj/app" });
		const ws1 = mkWS();
		const ws2 = mkWS();
		dev.websocket.open?.(ws1);
		dev.websocket.open?.(ws2);
		const id = (
			JSON.parse((ws1.send.mock.calls[0] as unknown as [string])[0]) as {
				serverId: string;
			}
		).serverId;
		const id2 = (
			JSON.parse((ws2.send.mock.calls[0] as unknown as [string])[0]) as {
				serverId: string;
			}
		).serverId;
		expect(id2).toBe(id);
	});

	test("fetch falls back to a 426 response", async () => {
		const dev = createDevServer({ appDir: "/proj/app" });
		const res = await dev.fetch(new Request("http://x/__patties_hmr"));
		expect(res.status).toBe(426);
	});

	test("notifyChange before attachServer is a no-op", () => {
		const dev = createDevServer({ appDir: "/proj/app" });
		expect(() => dev.notifyChange("/proj/app/routes/index.tsx")).not.toThrow();
	});
});
