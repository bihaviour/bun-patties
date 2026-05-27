---
"create-patties": minor
---

Repurpose `--template` as an agent platform selector. The flag now accepts
`claude` (default), `codex`, or `none`, and overlays the matching `CLAUDE.md` /
`AGENTS.md` on top of a single base template. The previous `default` /
`with-islands` / `ai-starter` triplet is collapsed: every new project ships
with a working server-rendered route plus an island example.

`package.json` is now synthesised in-memory with sorted dependencies and the
user-supplied project name, matching the create-next-app convention. Template
files use the `gitignore` (dotless) and `README-template.md` naming so they
survive npm publishing and get renamed on copy.
