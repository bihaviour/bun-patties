import { expect } from "bun:test";

export async function runSmokeSuite(base: string): Promise<void> {
	const get = (p: string): Promise<Response> =>
		fetch(`${base}${p}`, { redirect: "manual" });
	const post = (p: string, body: unknown): Promise<Response> =>
		fetch(`${base}${p}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
			redirect: "manual",
		});

	// 1. SSR root
	const home = await get("/");
	expect(home.status).toBe(200);
	const html = await home.text();
	expect(html).toContain("edge smoke");

	// 2. Island marker in HTML — React may split text with an HTML comment so
	// match "count:" and "1" separately.
	expect(html).toMatch(/count:.*1/);

	// 3. API GET
	const apiGet = await get("/api/ping");
	expect(apiGet.status).toBe(200);
	expect(await apiGet.json()).toMatchObject({ ok: true });

	// 4. API POST
	const apiPost = await post("/api/ping", { value: 42 });
	expect(apiPost.status).toBe(200);
	expect(await apiPost.json()).toMatchObject({ ok: true, echo: 42 });

	// 5. Middleware redirect
	const redir = await get("/old");
	expect([301, 302, 307, 308]).toContain(redir.status);
	expect(redir.headers.get("location")).toBe("/about");

	// 6. 404
	const missing = await get("/does-not-exist");
	expect(missing.status).toBe(404);
}

export async function which(bin: string): Promise<string | null> {
	const proc = Bun.spawn(["which", bin], { stdout: "pipe", stderr: "pipe" });
	const out = (await new Response(proc.stdout).text()).trim();
	await proc.exited;
	return out.length > 0 ? out : null;
}

export async function waitForListen(
	url: string,
	timeoutMs = 15_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { redirect: "manual" });
			if (res.status < 500) return;
		} catch {}
		await Bun.sleep(150);
	}
	throw new Error(`Timed out waiting for ${url}`);
}
