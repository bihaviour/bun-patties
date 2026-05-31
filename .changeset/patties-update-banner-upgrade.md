---
"patties": minor
---

Add an "update available" banner and a `patties upgrade` command.

The CLI now prints a cached, channel-aware banner on startup when a newer
`patties` is published, and `patties upgrade` bumps the project's dependency to
the newest release on its channel (`bun add patties@<latest|next|…>`). The
banner reads from a local cache and refreshes in the background, so it never
blocks the CLI; opt out with `--no-update-check` or `NO_UPDATE_NOTIFIER`.
