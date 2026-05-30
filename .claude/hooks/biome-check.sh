#!/usr/bin/env bash
# PostToolUse hook: run Biome on the file Claude just touched.
# No-ops cleanly when Biome is not installed so it's safe to ship by default.
set -euo pipefail

file="${CLAUDE_FILE_PATH:-${1:-}}"
if [[ -z "${file}" ]]; then exit 0; fi
case "${file}" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc) ;;
  *) exit 0 ;;
esac

if command -v biome >/dev/null 2>&1; then
  biome check --write --no-errors-on-unmatched "${file}" || exit 2
elif command -v bunx >/dev/null 2>&1; then
  bunx --bun @biomejs/biome check --write --no-errors-on-unmatched "${file}" 2>/dev/null || exit 0
fi
