// Minimal line-level unified diff. Bun-native (no diff dependency); inputs are
// single component files, so an O(N×M) LCS is more than adequate.

export type DiffOpType = "eq" | "del" | "add";
export interface DiffOp {
	type: DiffOpType;
	line: string;
}

export interface DiffHunk {
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	ops: DiffOp[];
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function splitLines(s: string): string[] {
	return s === "" ? [] : s.split("\n");
}

// LCS-based line diff. Returns an ordered op list (eq/del/add).
export function diffLines(current: string, incoming: string): DiffOp[] {
	const a = splitLines(current);
	const b = splitLines(incoming);
	const n = a.length;
	const m = b.length;
	const w = m + 1;
	// dp[i*w + j] = LCS length of a[i:] vs b[j:]
	const dp = new Int32Array((n + 1) * w);
	const at = (idx: number): number => dp[idx] ?? 0;
	for (let i = n - 1; i >= 0; i--) {
		const ai = a[i] ?? "";
		for (let j = m - 1; j >= 0; j--) {
			dp[i * w + j] =
				ai === (b[j] ?? "")
					? at((i + 1) * w + (j + 1)) + 1
					: Math.max(at((i + 1) * w + j), at(i * w + (j + 1)));
		}
	}

	const ops: DiffOp[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if ((a[i] ?? "") === (b[j] ?? "")) {
			ops.push({ type: "eq", line: a[i] ?? "" });
			i++;
			j++;
		} else if (at((i + 1) * w + j) >= at(i * w + (j + 1))) {
			ops.push({ type: "del", line: a[i] ?? "" });
			i++;
		} else {
			ops.push({ type: "add", line: b[j] ?? "" });
			j++;
		}
	}
	while (i < n) ops.push({ type: "del", line: a[i++] ?? "" });
	while (j < m) ops.push({ type: "add", line: b[j++] ?? "" });
	return ops;
}

interface Annotated {
	op: DiffOp;
	oldNo: number;
	newNo: number;
}

// Group ops into unified-diff hunks with `context` lines of surrounding eq.
export function toHunks(ops: DiffOp[], context = 3): DiffHunk[] {
	let o = 1;
	let nw = 1;
	const ann: Annotated[] = ops.map((op) => {
		const e: Annotated = {
			op,
			oldNo: op.type !== "add" ? o : 0,
			newNo: op.type !== "del" ? nw : 0,
		};
		if (op.type !== "add") o++;
		if (op.type !== "del") nw++;
		return e;
	});

	const changes: number[] = [];
	for (let k = 0; k < ann.length; k++) {
		if (ann[k]?.op.type !== "eq") changes.push(k);
	}
	if (changes.length === 0) return [];

	const groups: Array<[number, number]> = [];
	let start = changes[0] ?? 0;
	let prev = start;
	for (const idx of changes.slice(1)) {
		if (idx - prev <= context * 2) {
			prev = idx;
		} else {
			groups.push([start, prev]);
			start = idx;
			prev = idx;
		}
	}
	groups.push([start, prev]);

	const hunks: DiffHunk[] = [];
	for (const [gStart, gEnd] of groups) {
		const lo = Math.max(0, gStart - context);
		const hi = Math.min(ann.length - 1, gEnd + context);
		const slice = ann.slice(lo, hi + 1);
		const hunkOps = slice.map((e) => e.op);
		const oldStart = slice.find((e) => e.oldNo > 0)?.oldNo ?? 0;
		const newStart = slice.find((e) => e.newNo > 0)?.newNo ?? 0;
		const oldLines = hunkOps.filter((op) => op.type !== "add").length;
		const newLines = hunkOps.filter((op) => op.type !== "del").length;
		hunks.push({ oldStart, oldLines, newStart, newLines, ops: hunkOps });
	}
	return hunks;
}

// Render a unified diff. Colorized when `color`, plain otherwise.
export function formatUnifiedDiff(
	current: string,
	incoming: string,
	opts: { fromLabel: string; toLabel: string; color: boolean },
): string {
	const hunks = toHunks(diffLines(current, incoming));
	if (hunks.length === 0) return "";

	const c = opts.color;
	const paint = (code: string, s: string) => (c ? `${code}${s}${RESET}` : s);

	const out: string[] = [];
	out.push(paint(RED, `--- ${opts.fromLabel}`));
	out.push(paint(GREEN, `+++ ${opts.toLabel}`));
	for (const h of hunks) {
		out.push(
			paint(
				CYAN,
				`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`,
			),
		);
		for (const op of h.ops) {
			if (op.type === "eq") out.push(` ${op.line}`);
			else if (op.type === "del") out.push(paint(RED, `-${op.line}`));
			else out.push(paint(GREEN, `+${op.line}`));
		}
	}
	return out.join("\n");
}
