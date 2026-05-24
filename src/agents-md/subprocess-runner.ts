export interface ModuleQuery {
	kind: "agent" | "tool" | "job";
	file: string;
}

export interface ModuleResult {
	query: ModuleQuery;
	ok: boolean;
	data?: unknown;
	error?: string;
}

// Runs a batch of module loads inside a single isolated subprocess. Each
// module's top-level side effects die with the subprocess. A module whose
// top-level throws produces a per-query error, not a build crash.
export async function runSubprocessBatch(
	entryScript: string,
	queries: ModuleQuery[],
	opts: { timeoutMs?: number } = {},
): Promise<ModuleResult[]> {
	if (queries.length === 0) return [];

	const timeoutMs = opts.timeoutMs ?? 30_000;

	const proc = Bun.spawn(["bun", entryScript], {
		stdio: ["pipe", "pipe", "pipe"],
		env: process.env,
	});

	const results = new Map<string, ModuleResult>();
	const sink = proc.stdin as {
		write: (chunk: string) => void;
		end: () => void;
	} | null;
	for (let i = 0; i < queries.length; i++) {
		const id = String(i);
		const line =
			JSON.stringify({ id, file: queries[i]?.file, kind: queries[i]?.kind }) +
			"\n";
		sink?.write(line);
	}
	sink?.end();

	const reader = proc.stdout.getReader();
	const decoder = new TextDecoder();
	let buf = "";

	const timeout = new Promise<never>((_, reject) =>
		setTimeout(
			() => reject(new Error(`subprocess timeout after ${timeoutMs}ms`)),
			timeoutMs,
		),
	);

	const readAll = (async () => {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buf += decoder.decode(value, { stream: true });
			const lines = buf.split("\n");
			buf = lines.pop() ?? "";
			for (const line of lines) {
				const t = line.trim();
				if (!t) continue;
				const parsed = JSON.parse(t) as {
					id: string;
					ok: boolean;
					data?: unknown;
					error?: string;
				};
				const q = queries[Number(parsed.id)];
				if (!q) continue;
				results.set(parsed.id, {
					query: q,
					ok: parsed.ok,
					data: parsed.data,
					error: parsed.error,
				});
			}
		}
	})();

	try {
		await Promise.race([readAll, timeout]);
	} finally {
		try {
			proc.kill();
		} catch {
			// ignore
		}
	}
	await proc.exited;

	const out: ModuleResult[] = [];
	for (let i = 0; i < queries.length; i++) {
		const r = results.get(String(i));
		const q = queries[i];
		if (!q) continue;
		if (!r) {
			const stderrText = await new Response(proc.stderr).text().catch(() => "");
			out.push({
				query: q,
				ok: false,
				error: `no response from subprocess (stderr: ${stderrText.slice(0, 500) || "<empty>"})`,
			});
		} else {
			out.push(r);
		}
	}
	return out;
}
