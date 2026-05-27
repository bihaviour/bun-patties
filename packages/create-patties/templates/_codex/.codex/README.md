# Codex workspace config

Codex CLI reads project-level config from this directory. The conventions are
still evolving — see https://github.com/openai/codex for the current schema.

Patties auto-regenerates `AGENTS.md` at the project root on every
`patties build` to keep the live inventory of routes, islands, agents, and
tools in sync. Hand-edited sections marked with `<!-- patties:user -->` /
`<!-- /patties:user -->` are preserved across regenerations.
