# Lint + typecheck rule

- Formatter and linter: **Biome** (`biome.json`). Typecheck: `tsc --noEmit`.
- The `PostToolUse` hook at `.claude/hooks/biome-check.sh` runs `biome check <file>` and `tsc --noEmit` after every edit. The turn is blocked until both pass.
- Boy-scout mode: fix every Biome diagnostic in any file you edit, even pre-existing ones. Do not `// biome-ignore` your way out unless there is a real reason — note it in a one-line comment.
- Do not expand scope into untouched files just to clean them up.
- Aggregate locally with `bun run check`; full gate is `bun run validate` (lint + typecheck + test + knip).
