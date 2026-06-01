// Shared shapes for `patties doctor` (cli/20-doctor). Every check produces a
// `Finding`; the report aggregates them into a `DoctorReport`.

export type Status = "pass" | "warn" | "fail" | "skip";

export type Group = "Toolchain" | "Dependencies" | "Config" | "Monorepo";

/** Fixed render order; groups with no findings are omitted from the report. */
export const GROUP_ORDER: readonly Group[] = [
	"Toolchain",
	"Dependencies",
	"Config",
	"Monorepo",
];

export interface Finding {
	id: string;
	group: Group;
	status: Status;
	/** One-line human summary (no ANSI — color is applied at render time). */
	detail: string;
	/** The exact command to run, when there is one. */
	remedy?: string;
}

export interface Summary {
	failed: number;
	warning: number;
	passed: number;
	skipped: number;
}

export interface DoctorReport {
	checks: Finding[];
	summary: Summary;
}
