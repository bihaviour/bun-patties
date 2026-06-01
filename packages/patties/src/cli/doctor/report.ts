// Doctor report rendering. `renderText` produces the aligned, width-aware
// human report (color gated on TTY/NO_COLOR via log.ts); `renderJson` produces
// the CI-consumable shape with no ANSI. Detail strings are stored plain, so JSON
// never carries escapes and text-mode applies color at render time.

import { strip, terminalColumns, wrapWithPrefix } from "../ansi.ts";
import { type Color, colorize } from "../log.ts";
import {
	type DoctorReport,
	type Finding,
	GROUP_ORDER,
	type Status,
	type Summary,
} from "./types.ts";

export function summarize(checks: Finding[]): Summary {
	const summary: Summary = { failed: 0, warning: 0, passed: 0, skipped: 0 };
	for (const c of checks) {
		if (c.status === "fail") summary.failed++;
		else if (c.status === "warn") summary.warning++;
		else if (c.status === "pass") summary.passed++;
		else summary.skipped++;
	}
	return summary;
}

const SYMBOL: Record<Status, { glyph: string; color: Color }> = {
	pass: { glyph: "✓", color: "green" },
	warn: { glyph: "⚠", color: "yellow" },
	fail: { glyph: "✗", color: "red" },
	skip: { glyph: "–", color: "dim" },
};

export function renderText(report: DoctorReport): string {
	const cols = terminalColumns();
	const lines: string[] = ["patties doctor", ""];

	for (const group of GROUP_ORDER) {
		const rows = report.checks.filter((c) => c.group === group);
		if (rows.length === 0) continue;
		lines.push(`  ${group}`);
		for (const row of rows) {
			const { glyph, color } = SYMBOL[row.status];
			lines.push(`    ${colorize(process.stdout, color, glyph)} ${row.detail}`);
			if (row.remedy) {
				lines.push(
					wrapWithPrefix(row.remedy, cols, "        → ", "          "),
				);
			}
		}
	}

	const { failed, warning, passed, skipped } = report.summary;
	const parts = [`${failed} failed`, `${warning} warning`, `${passed} passed`];
	if (skipped > 0) parts.push(`${skipped} skipped`);
	lines.push("", `  ${parts.join(", ")}`);

	return `${lines.join("\n")}\n`;
}

export function renderJson(report: DoctorReport): string {
	// Detail strings are built plain, but strip defensively so the machine shape
	// is guaranteed ANSI-free regardless of how a finding was constructed.
	const checks = report.checks.map((c) => ({
		id: c.id,
		group: c.group,
		status: c.status,
		detail: strip(c.detail),
		remedy: c.remedy ? strip(c.remedy) : null,
	}));
	return `${JSON.stringify({ checks, summary: report.summary }, null, 2)}\n`;
}
