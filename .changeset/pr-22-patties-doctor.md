---
"patties": minor
---

Add `patties doctor`: a read-only project hygiene report. Runs and contextualizes `bun audit` / `bun outdated`, adds patties-specific checks (config validity, single-React invariant in monorepos), and prints one aligned report with a concrete remedy per finding. Composed from Bun builtins (`Bun.which`, `Bun.$`, `Bun.stringWidth`/`stripANSI`/`wrapAnsi`). Exit codes: 0 pass / 1 fail / 2 cannot-run.
