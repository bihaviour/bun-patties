# Project conventions

## Lint / typecheck

- Formatter and linter: **Biome** (`biome.json` at repo root).
- Typecheck: `bun run typecheck` (`tsc --noEmit`).
- A `PostToolUse` hook (`.claude/hooks/biome-check.sh`) runs `biome check <file>` plus `tsc --noEmit` after every `Edit`/`Write`/`MultiEdit`. The turn is blocked until both pass — fix the reported issues before moving on.

## Boy-scout mode

When you touch a file, leave it cleaner than you found it:

- **Fix every Biome diagnostic in any file you edit**, even ones unrelated to your task — warnings and errors alike. Don't whitelist or `// biome-ignore` your way out unless there is a real reason (note it in a one-line comment).
- If `tsc --noEmit` surfaces a TypeScript error in a file you touched, fix it before claiming the task done.
- Don't expand scope into untouched files just to clean them — boy-scout applies to files already in your diff.

## Tooling

- Runtime: Bun. Use `bun` / `bunx` rather than `node` / `npx`.
- Don't add comments that just describe what the code does. Only note WHY when non-obvious.
