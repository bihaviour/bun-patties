---
"create-patties": patch
---

Redesign the scaffolder prompt flow (cli specs 18 + 19): coding agent moves
earlier; a new **project type** (frontend / backend / fullstack) drives gated
sub-prompts for **Patties UI** and **monorepo** and the deploy-target option
set. Adds `--type`, `--ui`/`--no-ui`, `--monorepo`/`--no-monorepo`, `--theme`,
and a `container` target (emits a `Dockerfile`). When Patties UI is chosen, a
vendored starter set (button/card/input/label + tokens) is stamped so the demo
renders with real components. Claude / Codex projects now ship the `/patties`
skill + `/patties-init` command (Codex: a `patties-patterns` rule), generated
from one source so they can't drift, and the next-steps output hands off to
`claude --permission-mode plan "/patties-init"`. Stays zero-dependency.
