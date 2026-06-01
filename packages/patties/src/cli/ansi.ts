// Width-aware terminal output helpers, built on Bun builtins so the CLI never
// pulls the chalk-ecosystem trio (`string-width` / `strip-ansi` / `wrap-ansi`).
// See framework/24 §24.2 and rfc-bun-cli-ansi. Color *emission* stays inline in
// log.ts; this module is measurement + layout only.

/** Pad `s` on the right to `width` display columns. Never truncates. */
export function padEnd(s: string, width: number): string {
	const w = Bun.stringWidth(s);
	return w >= width ? s : s + " ".repeat(width - w);
}

/** Strip ANSI escapes — used before emitting to a non-TTY / `--json`. */
export function strip(s: string): string {
	return Bun.stripANSI(s);
}

/** Current terminal width, defaulting to 80 when not attached to a TTY. */
export function terminalColumns(): number {
	const cols = process.stdout.columns;
	return typeof cols === "number" && cols > 0 ? cols : 80;
}

/**
 * Hard-wrap `text` to `cols` (preserving inline ANSI styling), then prefix the
 * first line with `firstPrefix` and every continuation line with `contPrefix`.
 * Prefixes are applied *after* wrapping because `Bun.wrapAnsi` trims leading
 * whitespace per line, so a leading indent baked into `text` would be lost.
 */
export function wrapWithPrefix(
	text: string,
	cols: number,
	firstPrefix: string,
	contPrefix: string,
): string {
	const width = Math.max(1, cols - Bun.stringWidth(firstPrefix));
	const wrapped = Bun.wrapAnsi(text, width, { hard: true });
	return wrapped
		.split("\n")
		.map((line, i) => (i === 0 ? firstPrefix : contPrefix) + line)
		.join("\n");
}
