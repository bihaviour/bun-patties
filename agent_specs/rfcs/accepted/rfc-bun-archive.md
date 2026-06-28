---
rfc: bun-archive
title: Bun.Archive — tar/zip packaging for deploy plugins
status: encoded
encoded_in: ["framework/draft/24-bun-builtin-policy"]
encoded_on: 2026-05-27
verdict: accept
opened: 2026-05-27
reviewed: 2026-05-27
target_phase: 2
affects_specs: [24-bun-builtin-policy]
bun_unique: Bun-builtin
host_subsystem: framework/draft/24-bun-builtin-policy § 24.1 (deploy-plugin packaging)
comparable_elsewhere: Node uses `tar` / `adm-zip` / `archiver` libs. Vercel CLI packages internally (closed). Wrangler bundles Workers in its own way. SST uses `archiver`.
---

## Review verdict (2026-05-27)

**Accept** as a policy adoption — not a standalone spec feature.
Deploy plugins (`@patties/deploy-aws-lambda`,
`@patties/deploy-app-engine`, etc.) need to package the build
output into vendor-specific artifact shapes (Lambda zip, App
Engine tar.gz, etc.). The Node solution is `tar` + `archiver` +
`adm-zip` — three deps to cover three formats. Bun ships archive
read/write in core.

Codified as section 24.1 of the **Bun-builtin policy spec**
([[framework/draft/24-bun-builtin-policy]]) rather than its own
feature spec, because there's no first-party `patties deploy`
command yet — `Bun.Archive` becomes the "reach for this when you
need it" answer for plugin authors.

Scope pins:
- **Use only in deploy / packaging plugins**, not in framework
  core. The framework emits a directory; packaging is a deploy
  concern.
- **`tar` and `zip` formats** for v1. `tar.gz` via composing
  `format: "tar"` + `Bun.gzipSync`.
- **Streaming output** to stdout (for piping into vendor CLIs
  like `aws lambda update-function-code`).

Out of scope for this RFC:
- **A first-party `patties deploy` command** — separate RFC if it
  ever lands.
- **Archive extraction in user app code** — borderline out-of-scope;
  if a user wants to extract uploads at runtime, they can call
  `Bun.Archive` directly without framework involvement.

---

# RFC — Bun.Archive → deploy-plugin packaging

## Summary

`Bun.Archive` reads and writes tar / zip files in-process. Deploy
plugins reach for it when packaging a build directory into a
single uploadable artifact.

## Motivation

Today, deploy plugins emit a directory (`dist/`) and the user
zips or tars it themselves. For vendor platforms that require a
specific archive shape (Lambda's flat zip, App Engine's
`source.tar.gz`), the plugin should produce that artifact
directly. The Node solution is multi-dep; Bun's is built in.

## Proposal

See [[framework/draft/24-bun-builtin-policy|spec 24]] § 24.1 for
the policy and concrete patterns. Summary:

- Deploy plugins use `new Bun.Archive({ format })` to build
  uploadable artifacts.
- Output target is either a `Uint8Array` (in-memory for vendor
  CLI piping) or `Bun.write(path, archive.toBytes())` for
  file output.
- `tar.gz` composes from `format: "tar"` + `Bun.gzipSync` rather
  than a magic combined mode.

## Trade-offs

- **Bun.Archive's API may lag** mature libs like `tar` for exotic
  cases (symlink handling, ACL preservation). v1 covers the
  common cases that deploy plugins actually need.
- **Streaming write** isn't needed for sub-100MB artifacts; v1
  builds the whole archive in memory before emitting.

## Open questions

- **Symlink preservation** — Lambda zip ignores symlinks; tar.gz
  preserves them. Document per-format behavior when first deploy
  plugin lands.
- **Reproducibility** — vendor deploys care about deterministic
  hashes. `Bun.Archive` should produce byte-identical output for
  identical input; verify when first plugin ships.
