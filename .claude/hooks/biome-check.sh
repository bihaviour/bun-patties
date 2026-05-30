#!/usr/bin/env bash
# PostToolUse hook: run Biome on the edited file + project-wide typecheck.
# On any failure, emit JSON that blocks the turn and feeds errors back to the model.

set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')

# Skip if no file or not a JS/TS source
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

# Resolve project root from this script's location
root="$(cd "$(dirname "$0")/.." && cd .. && pwd)"
cd "$root" || exit 0

biome_out=$(bunx --bun biome check "$file" 2>&1); biome_rc=$?
tsc_out=$(bunx --bun tsc --noEmit 2>&1); tsc_rc=$?

if [ $biome_rc -eq 0 ] && [ $tsc_rc -eq 0 ]; then
  exit 0
fi

reason=""
[ $biome_rc -ne 0 ] && reason+=$'Biome reported issues in '"$file"$':\n'"$biome_out"$'\n\n'
[ $tsc_rc -ne 0 ] && reason+=$'TypeScript errors (tsc --noEmit):\n'"$tsc_out"$'\n'
reason+=$'\nFix these before continuing. Apply boy-scout mode: also clean up any pre-existing warnings in files you touched.'

jq -n --arg r "$reason" '{decision:"block", reason:$r}'
