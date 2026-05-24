// Build the dev error page as an HTML string using Bun.escapeHTML, then return
// a Response. We bypass React for the error page so a broken render path can
// always produce something useful.

interface StackFrame {
	file: string;
	line: number;
	column?: number;
}

function parseStack(stack: string): StackFrame[] {
	const frames: StackFrame[] = [];
	for (const raw of stack.split("\n")) {
		const m = raw.match(/\(?([^()\s]+\.tsx?):(\d+)(?::(\d+))?\)?/);
		if (!m || !m[1] || !m[2]) continue;
		frames.push({
			file: m[1],
			line: Number(m[2]),
			column: m[3] ? Number(m[3]) : undefined,
		});
	}
	return frames;
}

async function snippetFor(file: string, line: number): Promise<string> {
	try {
		const text = await Bun.file(file).text();
		const lines = text.split("\n");
		const start = Math.max(0, line - 3);
		const end = Math.min(lines.length, line + 2);
		const out: string[] = [];
		for (let i = start; i < end; i++) {
			const marker = i + 1 === line ? "> " : "  ";
			const num = String(i + 1).padStart(4, " ");
			out.push(`${marker}${num} | ${lines[i] ?? ""}`);
		}
		return Bun.escapeHTML(out.join("\n"));
	} catch {
		return "";
	}
}

export async function renderDevErrorPage(err: unknown): Promise<Response> {
	const inspected = Bun.escapeHTML(Bun.inspect(err, { colors: false }));
	const stack = err instanceof Error && err.stack ? err.stack : "";
	const frames = parseStack(stack);

	const frameBlocks: string[] = [];
	for (const f of frames.slice(0, 5)) {
		const snippet = await snippetFor(f.file, f.line);
		const link = `/__patties_open?file=${encodeURIComponent(f.file)}&line=${f.line}`;
		frameBlocks.push(
			`<section><a href="${Bun.escapeHTML(link)}"><code>${Bun.escapeHTML(f.file)}:${f.line}</code></a>` +
				(snippet ? `<pre>${snippet}</pre>` : "") +
				`</section>`,
		);
	}

	const body =
		`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Patties dev error</title>` +
		`<style>body{font:14px/1.4 ui-monospace,Menlo,monospace;padding:24px;color:#222;background:#fff8f6}` +
		`h1{color:#b00020}pre{background:#fff;border:1px solid #eee;padding:8px 12px;overflow:auto}` +
		`section{margin:12px 0}a{color:#0049b0;text-decoration:none}</style></head><body>` +
		`<h1>Render error</h1><pre>${inspected}</pre>` +
		frameBlocks.join("") +
		`<footer><small>HMR connected - this page will reload when you fix the source.</small></footer>` +
		`</body></html>`;

	return new Response(body, {
		status: 500,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}
