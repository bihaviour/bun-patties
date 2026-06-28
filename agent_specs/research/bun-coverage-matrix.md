# Bun API Coverage Matrix — Patties Framework

- **Source:** `https://bun.com/llms-full.txt` (54,408 lines)
- **Fetched:** 2026-05-23
- **Last reclassified:** 2026-05-31
- **Specs audited:** `agent_specs/framework/archive/phase-{0..4}/*.md`, `agent_specs/framework/archive/{00-overview,13-conventions,19-request-id,20-server-timing,21-embedded-files}.md`, `agent_specs/framework/draft/{17-dev-island-bundler,18-dev-island-bundler-impl,22-image-pipeline,23-markdown-pages,24-bun-builtin-policy}.md`, `agent_specs/cli/{draft,archive}/*.md` (35 files total). Specs 19, 20, and 21 shipped and moved `progress/` → `archive/` on 2026-05-30.
- **Raw text:** `agent_specs/research/bun-surface-raw.txt`

The catalogue covers every `Bun.*` global, every `bun:*` built-in module, the notable `bun` CLI verbs/flags, and Bun-specific language features (import attribute types, HMR `import.meta`, embedded files) found in `llms-full.txt`. Classification reflects whether a Patties spec currently names the API, whether it should, or whether it belongs outside the framework's surface.

## Summary

| Status | Count | RFC file location |
|---|---|---|
| `relevant-gap` | 0 | — |
| `encoded` | 19 | `rfcs/accepted/` |
| `covered` | 35 | (no RFC needed — already used in a spec) |
| `rfc-later` (backlog) | 7 | `rfcs/backlog/` |
| `deferred` | 3 | `rfcs/deferred/` |
| `out-of-scope` | 28 | 22 no-RFC-needed + 6 with an RFC in `rfcs/out-of-scope/` (new 2026-05-31) |
| **Total catalogued** | **92** | |

The nineteen `encoded` rows correspond to accepted RFCs in `rfcs/accepted/`. As of 2026-05-31 a fourth RFC bucket exists: **`rfcs/out-of-scope/`** for permanently-dismissed-but-discovered APIs (distinct from `deferred/`, which stays revisitable on a named trigger). Every `rfc-later` row has a corresponding stub RFC in `rfcs/backlog/` (7 files) so the matrix and the RFC tree stay in lockstep. No new `relevant-gap` items were found in this refresh.

> **Two RFC families share the `rfcs/` tree.** This matrix tracks the **`rfc-bun-*`** family (Bun-API coverage). A second family, **`rfc-patties-ui-*`**, tracks shadcn-parity for the copy-in UI catalog and is tracked by a separate matrix — [`patties-ui-parity-matrix.md`](./patties-ui-parity-matrix.md). The two families do not overlap: `rfc-bun-*` is about *which Bun primitive a framework feature reaches for*; `rfc-patties-ui-*` is about *which shadcn scaffold capability patties-ui ships*. When auditing `rfcs/{accepted,backlog,deferred,out-of-scope}/`, filter by prefix — counts in this matrix's summary cover `rfc-bun-*` only. Current patties-ui RFCs: 8 accepted (`rfc-patties-ui-{update-diff,config-block,add-path,view,init,migrate,theming,registries}`), 0 backlog, 0 deferred, 1 out-of-scope (`rfc-patties-ui-theme-editor`, moved 2026-05-31).

**2026-05-31 changes (RFC-disposition pass + new `out-of-scope/` bucket):**
- **New bucket `rfcs/out-of-scope/`** — permanent "considered & dismissed" home, distinct from revisitable `deferred/`.
- **Moved backlog → out-of-scope** the four `verdict: defer (borderline out-of-scope)` rows that only sat in backlog because no out-of-scope bucket existed: `Bun.connect/listen` ([[rfc-bun-tcp]]) + `Bun.udpSocket` ([[rfc-bun-udp]]) — raw sockets are below a HTTP-only framework's altitude; `Bun.peek` ([[rfc-bun-peek]]) — internals-only, never user-facing; `Bun.fileURLToPath/pathToFileURL` ([[rfc-bun-path-url]]) — identical to `node:url`, nothing to own. `rfc-later` count 11 → 7.
- **Encoded** `Bun.task-cache` composition → [[rfc-bun-task-cache]] (accept) → `framework/27-task-runner-cache` (Bun-native monorepo task-output cache + affected detection; RFC filed draft→`accepted/`). *(new catalogued row, +1 total)*
- **Encoded** `bun audit / outdated / which (lifecycle)` → [[rfc-bun-package-hygiene]] (accept, pulled forward to 0.1.x) → new spec `cli/20-doctor` (`patties doctor` project-hygiene checks). Lands the "doctor cluster" — reuses `Bun.which` ([[rfc-bun-which]]) + `Bun.stringWidth`/`stripANSI`/`wrapAnsi` (spec 24 §24.2). `deferred → accepted/`.
- **Promoted to backlog** `bun pm` catalogs/workspaces → [[rfc-bun-pm]] — its named trigger fired (spec 18 `--monorepo` + specs 26/27 now exercise Bun workspaces/`--filter`/catalogs). `deferred → backlog/`.
- **Moved to out-of-scope** (permanent no): `Bun.color` → [[rfc-bun-color]] (no consumer — patties-ui theming ships pre-authored `tokens.css`, never parses color) and `Bun.sleep` → [[rfc-bun-sleep]] (trivial `setTimeout` wrapper, no slot). `deferred → out-of-scope/`. Also `rfc-patties-ui-theme-editor` (ui family) → `out-of-scope/` (visual editor is community/app-level; distribution already covered by [[rfc-patties-ui-registries]]).
- **Confirmed deferred, trigger retargeted** `Bun.YAML/TOML/JSON5` → [[rfc-bun-config-formats]] — revisit when the plugin/deploy-adapter surface ([[framework/phase-4/09-plugins]]) wants vendor config through the loader.
- **Reaffirmed deferred**: [[rfc-bun-cookie-signing]] — better-auth (bring-your-own backend, per spec 19) owns auth cookie signing, so it's *not needed for auth*; kept deferred only for a possible **non-auth** signed-cookie need (flash messages, signed prefs). [[rfc-bun-html-imports]] — "ok for now"; scheduled re-eval after spec 18 ships.

**2026-05-27 changes:**
- New draft specs `framework/draft/17-dev-island-bundler` and `framework/draft/18-dev-island-bundler-impl` audited — introduce no new Bun APIs (use already-covered `Bun.build`, `bun --hot`, `Bun.serve` routes, `Bun.file`). Spec 17's "Future re-evaluation" section gives the deferred [[rfc-bun-html-imports]] a concrete trigger to revisit (one release cycle after spec 18 ships).
- Promoted `Bun.randomUUIDv7` from `rfc-later` → `encoded` via [[rfc-bun-random-uuidv7]] (accept) → `framework/draft/19-request-id` (new spec; supersedes the relevant slices of the archived phase-1 middleware and phase-3 agents specs).
- **Bucket-A acceptance pass.** Promoted three `rfc-later` rows to `encoded`:
  - `Bun.nanoseconds` → [[rfc-bun-nanoseconds]] (accept) → `framework/draft/20-server-timing` (dev-only `Server-Timing: total;dur=<ms>` header; extends the spec-19 response finalizer).
  - `Bun.which` → [[rfc-bun-which]] (accept) → `cli/draft/10-scaffold-probes` (bun-fail + git-warn probes for `create-patties`; additive to spec 09).
  - `Bun.embeddedFiles` → [[rfc-bun-embedded-files]] (accept) → `framework/archive/21-embedded-files` (single-binary deploy with embedded static assets; only Bun-only structural unlock in the bucket).
- **Bucket-A defer pass.** Promoted two `rfc-later` rows to `deferred` (full RFCs with re-evaluation triggers):
  - `Bun.Cookie` cookie signing → [[rfc-bun-cookie-signing]] (reject-for-v1) — no auth/session consumer in the codebase; users can compose `Bun.CryptoHasher` + `ctx.cookies` manually.
  - `Bun.YAML` / `Bun.TOML` / `Bun.JSON5` → [[rfc-bun-config-formats]] (reject-for-v1) — preserve the TS-first config virtue; no demand signal yet.
- **Bucket-B "Bun-builtin dep-replacement" sweep.** Reframed the matrix lens — patties' value isn't "do what Next can't" but "do what every Node framework does, with a fraction of the dependency surface." Promoted five more `rfc-later` rows to `encoded`:
  - `Bun.Image` → [[rfc-bun-image]] (accept) → `framework/draft/22-image-pipeline` (`next/image`-class pipeline: build-time variants + signed runtime endpoint + disk LRU cache, no Sharp dep).
  - `Bun.markdown` → [[rfc-bun-markdown]] (accept) → `framework/draft/23-markdown-pages` (`.md`/`.mdx` routes with constrained-MDX islands support, no remark/rehype/MDX dep stack).
  - `Bun.Archive` → [[rfc-bun-archive]] (accept) → `framework/draft/24-bun-builtin-policy` § 24.1 (tar/zip for deploy plugins, no `tar`/`archiver` dep).
  - `Bun.stringWidth` / `stripANSI` / `wrapAnsi` → [[rfc-bun-cli-ansi]] (accept) → `framework/draft/24-bun-builtin-policy` § 24.2 (CLI text formatting, no chalk-ecosystem dep).
  - `Bun.hash` / `Bun.sha` → [[rfc-bun-hash]] (accept) → `framework/draft/24-bun-builtin-policy` § 24.3 (one-shot hashing; `Bun.CryptoHasher` still owns streaming).
- **Bucket-B defer pass.** Promoted four `rfc-later` rows to `deferred` (full RFCs with re-evaluation triggers):
  - `Bun.sleep` / `Bun.sleepSync` → [[rfc-bun-sleep]] (reject-for-v1) — trivial userland; no framework slot.
  - `Bun.color` → [[rfc-bun-color]] (reject-for-v1) — patties is a framework, not a design system.
  - `bun pm` (catalogs/workspaces) → [[rfc-bun-pm]] (reject-for-v1) — no monorepo demand; revisit when a real multi-app patties project lands.
  - `bun patch` / `audit` / `outdated` → [[rfc-bun-package-hygiene]] (reject-for-v1) — needs `patties doctor` as host, which doesn't exist yet.
- Created `rfcs/backlog/` and seeded it with stub RFCs — one per `rfc-later` row. As of the bucket-A pass above, 22 stubs remain in `rfcs/backlog/` (down from 24). Each stub carries the same Bun-unique / comparable / trigger metadata as the matrix row, so future promotions can edit one place (the RFC) and update the matrix from it.
- Tables expanded with two new columns: **Bun-unique?** (does Bun unlock this, or could Next on Node do it?) and **Comparable elsewhere** (closest analog in Next.js / Remix / SvelteKit / Astro). See the legend below.
- Fixed off-by-N counts in the summary table — the previous totals (94, 26, 23) didn't match the actual row counts. The numbers above are computed from the tables.

**2026-05-30 changes (spec-location only; no reclassification):**
- `Bun.randomUUIDv7` / `Bun.nanoseconds` shipped (commit `91848f2`). Their host specs moved `progress/` → `archive/` with `status: completed`: `framework/19-request-id`, `framework/20-server-timing`. Both stay `encoded`; the matrix pointers and the `encoded_in` / `host_subsystem` fields in [[rfc-bun-random-uuidv7]] / [[rfc-bun-nanoseconds]] now point at `framework/archive/`.
- `Bun.embeddedFiles` shipped (commit `37645e9`). Its host spec moved `progress/` → `archive/` with `status: completed`: `framework/21-embedded-files`. Stays `encoded`; the matrix pointer and the `encoded_in` field in [[rfc-bun-embedded-files]] now point at `framework/archive/`.

## How to read the Bun-unique column

This column answers: "could a Node-based meta-framework (Next.js, Remix, SvelteKit, Astro) do the same thing?"

- **Bun-only** — Node has no comparable API, or only via experimental flags / native addons that are awkward to ship. Bun genuinely unlocked this; a framework on Node can't ship it without significant ceremony. *This is where the choice of Bun pays off.*
- **Bun-faster** — Same conceptual API exists on Node; Bun's implementation is materially faster (often by orders of magnitude — `bun install` vs `npm install`, `Bun.spawn` vs `child_process.spawn`). Capability is not new.
- **Bun-builtin** — Node could but you'd install a library; Bun ships it as a global or module. Removes a dependency and its maintenance surface (`Bun.password` vs `bcrypt`, `Bun.semver` vs `semver` npm).
- **Standard** — WHATWG / web / Node-standard API with no Bun-specific advantage (`Bun.env` ≈ `process.env`, `Bun.gzipSync` ≈ `zlib.gzipSync`).
- **n/a** — internal, joke, or false-positive entry; no comparison meaningful.

The framework's value proposition spans both **Bun-only** and **Bun-builtin** categories — both are legitimate wins. Bun-only items (embedded-files, HTMLRewriter, serve-routes, hot-reload) deliver capabilities Next-on-Node fundamentally cannot ship. Bun-builtin items (Image, markdown, cookies, cron, secrets, archive, ANSI helpers, hash) deliver capabilities Next-on-Node ships via heavy native addons (Sharp 30+MB, bcrypt) or multi-package dep stacks (remark/rehype/MDX, chalk-ecosystem); patties ships them with a fraction of the install footprint and faster cold-start.

**The framing the matrix codifies (set 2026-05-27 after the bucket-A passes):** patties isn't "Next.js, but with Bun-exclusive features." It's "Next.js, rebuilt knowing Bun exists — same capabilities, smaller dep surface, faster boot." The 17 encoded RFCs reflect this — most are Bun-builtin replacements of common Node ecosystem libs, not Bun-only unlocks.

## Matrix

### Encoded (accepted RFCs that have landed in a spec)

| API | Bun-unique? | Comparable elsewhere | Encoded via |
|---|---|---|---|
| `Bun.CookieMap` / `Bun.Cookie` | Bun-builtin | `next/headers` `cookies()` (Next 13+); Remix `createCookie()`; Hono `getCookie`/`setCookie`. Node needs `cookie` npm. | [[rfc-bun-cookies]] (accept) → `framework/phase-1/07-middleware`, `framework/00-overview` |
| `Bun.CSRF` | Bun-builtin | Next Server Actions auto-validate origin (Next 13.4+); Remix has no built-in CSRF; Node needs `csurf` / `next-csrf`. | [[rfc-bun-csrf]] (accept-with-deferral) → `framework/phase-1/07-middleware` |
| `Bun.cron` / `Bun.CronController` | Bun-builtin | Vercel Cron Jobs (external infra); Next has no in-process scheduler; Node uses `node-cron` / `croner` libs over `setTimeout`. | [[rfc-bun-cron]] (accept) → `framework/phase-3/10-agents-and-tools`, `framework/phase-4/09-plugins` |
| `HTMLRewriter` | Bun-only | Cloudflare Workers ship the same primitive; Next has no streaming HTML transformer (uses React renderer); Node has no equivalent (`parse5` isn't streaming). | [[rfc-bun-htmlrewriter]] (accept-phase-2) → `framework/phase-0/03-render` |
| `Bun.secrets` | Bun-only | Vercel env-var UI (external); Next stores secrets in `.env.local` / platform env; Node has `keytar` (deprecated native addon). | [[rfc-bun-secrets]] (accept-dev-only) → `framework/phase-2/08-config`, `cli/08-secret-command` |
| `Bun.serve` routes (`routes:` object) | Bun-only | Next App Router (file-based, framework-owned); Hono / Express / Fastify (lib-owned); Node `http.createServer` has no native pattern matching. | [[rfc-bun-serve-routes]] (accept-as-primary-router) → `framework/phase-0/01-server`, `framework/phase-0/02-router`, `framework/phase-0/02b-filesystem-router`, `framework/phase-2/12-edge-adapters` |
| `bun --hot` (incl. `import.meta.hot`) | Bun-only | Next dev (Webpack/Turbopack); Vite HMR. Node has `--watch` (restart, not HMR). Runtime-level module-graph HMR without a bundler is a Bun unlock. | [[rfc-bun-hot-reload]] (accept) → `framework/phase-1/05-dev-hmr`, `cli/02-dev-command` |
| Import attributes (`with { type: ... }`) | Standard for `json`; Bun-only for `macro` / `text` / `toml` / `file` | `with { type: "json" }` is TC39 (Node 22+); `type: "macro"` / `text` / `toml` / `file` are Bun-specific. Next has SWC macros (different abstraction). | [[rfc-bun-import-attributes]] (accept-with-scope) → `framework/phase-1/04-build`, `framework/phase-1/05-dev-hmr` (and via 02b-filesystem-router) |
| `Bun.randomUUIDv7` | Bun-builtin | Next has no UUID helper; users call `crypto.randomUUID()` (UUIDv4) or install `uuidv7` npm. Node 23+ may add v7 natively (draft RFC). | [[rfc-bun-random-uuidv7]] (accept) → `framework/archive/19-request-id`. Promoted from `rfc-later` on 2026-05-27; shipped on 2026-05-30. |
| `Bun.nanoseconds` | Bun-faster | Node has `process.hrtime.bigint()` (same precision). Next emits `Server-Timing` automatically for some internal phases; not a user-controlled API. Hono has a `timing()` middleware. | [[rfc-bun-nanoseconds]] (accept) → `framework/archive/20-server-timing` (dev-only `Server-Timing: total;dur=<ms>`; rides the spec-19 response finalizer). Promoted from `rfc-later` on 2026-05-27; shipped on 2026-05-30. |
| `Bun.which` | Bun-builtin | Node `which` npm; Next CLI / Astro CLI use it via deps. POSIX `which` / `command -v` builtins. | [[rfc-bun-which]] (accept) → `cli/draft/10-scaffold-probes` (bun fail + git warn in `create-patties`). Promoted from `rfc-later` on 2026-05-27. |
| `Bun.embeddedFiles` | Bun-only | **None.** Node SEA can embed assets but is awkward and rarely shipped. Next / Remix / SvelteKit have no single-binary deploy. Deno `compile` lacks the embed-file API. | [[rfc-bun-embedded-files]] (accept) → `framework/archive/21-embedded-files` (single-binary deploy with embedded static assets in compile mode). Promoted from `rfc-later` on 2026-05-27; shipped 2026-05-30. |
| `Bun.Image` | Bun-builtin | `next/image` uses Sharp (30+ MB native addon); Astro Image uses Sharp; Vercel Image Optimization is CDN-side. Bun.Image is in-process, no native addon. | [[rfc-bun-image]] (accept) → `framework/draft/22-image-pipeline` (`<Image>` component + build-time variants + signed runtime endpoint + disk LRU cache). Promoted from `rfc-later` on 2026-05-27. |
| `Bun.markdown` | Bun-builtin | `@next/mdx` + remark/rehype/unified plugin pipeline (~12 deps); Astro content collections; Contentlayer; MDXJS via `next-mdx-remote`. | [[rfc-bun-markdown]] (accept) → `framework/draft/23-markdown-pages` (`.md`/`.mdx` routes with constrained-MDX islands support; YAML frontmatter via `Bun.YAML` internal use). Promoted from `rfc-later` on 2026-05-27. |
| `Bun.Archive` | Bun-builtin | Node uses `tar` / `adm-zip` / `archiver` libs. SST uses `archiver`. Wrangler bundles Workers internally. | [[rfc-bun-archive]] (accept) → `framework/draft/24-bun-builtin-policy` § 24.1 (tar/zip for deploy plugins). Promoted from `rfc-later` on 2026-05-27. |
| `Bun.stringWidth` / `stripANSI` / `wrapAnsi` | Bun-builtin | Node uses `string-width` / `strip-ansi` / `wrap-ansi` (chalk ecosystem). Next CLI / Astro CLI use these via transitive deps. | [[rfc-bun-cli-ansi]] (accept) → `framework/draft/24-bun-builtin-policy` § 24.2 (CLI text formatting). Promoted from `rfc-later` on 2026-05-27. |
| `Bun.hash` / `Bun.sha` | Bun-builtin | Node's `crypto.createHash` / `crypto.subtle.digest`. The `xxhash` / `xxhash-wasm` npm packages for non-crypto fingerprints. | [[rfc-bun-hash]] (accept) → `framework/draft/24-bun-builtin-policy` § 24.3 (one-shot hashing; `Bun.CryptoHasher` still owns streaming). Promoted from `rfc-later` on 2026-05-27. |

### Deferred (RFC drafted but rejected for v1)

| API | Bun-unique? | Comparable elsewhere | Reason + re-eval trigger |
|---|---|---|---|
| Bun fullstack `index.html` imports | Bun-only | Vite uses `index.html` as the entry; Next has no HTML-as-entry mode (everything goes through the framework router). | [[rfc-bun-html-imports]] (reject-for-v1) — overlaps with the framework's own islands pipeline; running two HMR systems is confusing. Re-evaluate one release cycle after `framework/draft/18-dev-island-bundler-impl` ships and stabilizes (see spec 17's "Future re-evaluation"). |
| `Bun.Cookie` cookie signing | Bun-builtin | Remix `createCookie({ secrets })` has built-in HMAC signing; Next has none (users reach for `iron-session` / `jose`); Hono `getSignedCookie`. | [[rfc-bun-cookie-signing]] (reject-for-v1) — no auth/session consumer in the codebase yet. Users can compose `Bun.CryptoHasher` + `ctx.cookies` manually. Re-evaluate when a first-party auth/session spec is being drafted. Deferred on 2026-05-27. |
| `Bun.YAML` / `Bun.TOML` / `Bun.JSON5` / `Bun.JSONL` | Bun-builtin | Next config JS-only; Astro TS; Nuxt JSON. `wrangler.toml` / `fly.toml` use TOML for deploy. | [[rfc-bun-config-formats]] (reject-for-v1) — preserve the TS-first config virtue; no demand signal yet. Re-evaluate when a deploy adapter wants vendor-config-format overlap with `patties.config.*`. Deferred on 2026-05-27. |
| `Bun.sleep` / `Bun.sleepSync` | Bun-builtin | `node:timers/promises.setTimeout(ms)` on Node; `new Promise(r => setTimeout(r, ms))` everywhere. | [[rfc-bun-sleep]] (reject-for-v1) — trivial userland; no framework slot. Borderline out-of-scope. Deferred on 2026-05-27. |
| `Bun.color` | Bun-builtin | Tailwind, `culori`, `chroma-js`, Vanilla Extract, Radix Colors. Not standard in Next/Remix. | [[rfc-bun-color]] (reject-for-v1) — patties is a framework, not a design system; no styling-helper surface. Borderline out-of-scope. Deferred on 2026-05-27. |
| `bun pm` (catalogs / workspaces) | Bun-faster | pnpm workspaces + catalogs (pnpm 9.5+); Turborepo; Nx. Next.js works inside any of these. | [[rfc-bun-pm]] (reject-for-v1) — no monorepo demand; revisit when a real multi-app patties project lands. Deferred on 2026-05-27. |
| `bun patch` / `bun audit` / `bun outdated` | Bun-builtin | `npm audit` / `npm outdated`; `patch-package` (community lib). Standard hygiene tooling. | [[rfc-bun-package-hygiene]] (reject-for-v1) — needs `patties doctor` as host, which doesn't exist yet. Deferred on 2026-05-27. |

### Covered (APIs already used by a spec — no RFC needed)

| API | Bun-unique? | Comparable elsewhere | Spec / Rationale |
|---|---|---|---|
| `Bun.serve` | Bun-only | Next is built on `node:http`; Hono / Express / Fastify wrap it. Bun.serve is the only first-class HTTP server in Bun (WHATWG `Request`/`Response`, not `IncomingMessage`/`ServerResponse`). | `framework/phase-0/01-server`, `framework/phase-2/08-config`, `framework/phase-2/12-edge-adapters`, `framework/13-conventions` |
| `Bun.serve` `unix` / `reusePort` / `static` | Bun-only | Node supports `reusePort` via socket flags; unix sockets via path option; no native static-file route. Bun packages them as first-class options. | `framework/phase-0/01-server` |
| `Bun.Server` (type) | n/a | — | `framework/phase-0/01-server` (return type of `startServer`) |
| WS pub/sub topics (`ws.subscribe`, `server.publish`) | Bun-only | Node uses `ws` lib + you build pub/sub yourself (or Socket.IO rooms). Next has no first-class WebSocket. | `framework/phase-1/05-dev-hmr` |
| `Bun.build` | Bun-only | Next uses SWC + Webpack/Turbopack; Vite uses Rollup; `esbuild` is the closest comparable as a separate install. Bun's bundler is in the runtime. | `framework/phase-1/04-build`, `framework/phase-1/06-client-islands`, `framework/phase-2/08-config`, `framework/phase-2/12-edge-adapters`, `framework/13-conventions` |
| `Bun.build --compile` (standalone exe) | Bun-only | Deno `deno compile`. Node has experimental SEA — awkward, rarely shipped. **Next has no equivalent** — deploy is always Node + Next bundle, never a single binary. | `framework/phase-1/04-build`, `framework/phase-2/12-edge-adapters` |
| `Bun.Glob` | Bun-builtin | `fast-glob` / `globby` on Node. `node:fs/promises` glob is experimental in recent Node. | `framework/00-overview`, `framework/phase-0/02b-filesystem-router`, `framework/phase-1/04-build`, `framework/phase-2/12-edge-adapters` |
| `Bun.file` | Bun-only | Node uses `fs.createReadStream` / `fs.readFile`. `Bun.file` returns a lazy `BunFile` that supports streaming, sizing, and direct `Response` construction in one call. | `framework/phase-0/02b-filesystem-router`, `framework/phase-0/03-render`, `framework/phase-1/04-build`, `framework/phase-2/12-edge-adapters`, `framework/13-conventions` |
| `Bun.write` | Bun-only | Node uses `fs.writeFile`. Bun's `write` accepts more input types (Blob / Response / BunFile) and writes atomically. | `framework/phase-1/04-build`, `framework/phase-3/11-agents-md-generator`, `framework/13-conventions` |
| `Bun.CryptoHasher` | Bun-faster | `crypto.createHash` on Node — same API, Bun's is faster. | `framework/phase-1/04-build`, `framework/13-conventions` |
| `Bun.password` | Bun-builtin | Node uses `bcrypt` / `argon2` (native addons). `Bun.password.hash/verify` is built-in, picks Argon2id by default. | `framework/phase-4/09-plugins`, `framework/13-conventions` |
| `bun:sqlite` | Bun-builtin | Node uses `better-sqlite3` (native addon). `bun:sqlite` is API-compatible and zero-install. | `framework/phase-4/09-plugins`, `framework/13-conventions` |
| `Bun.sql` / `Bun.SQL` | Bun-builtin | Node uses `pg` / `postgres.js`. Bun ships a native Postgres client. | `framework/phase-4/09-plugins`, `framework/13-conventions` |
| `Bun.RedisClient` / `Bun.redis` | Bun-builtin | Node uses `ioredis` / `redis`. Bun ships a native client. | `framework/phase-4/09-plugins`, `framework/13-conventions` |
| `Bun.S3Client` / `Bun.s3` | Bun-builtin | Node uses `@aws-sdk/client-s3` (heavy). Bun ships a lightweight native S3 client. | `framework/phase-4/09-plugins`, `framework/13-conventions` |
| `Bun.semver` | Bun-builtin | Node uses `semver` npm. | `framework/phase-4/09-plugins` |
| `Bun.spawn` | Bun-faster | `node:child_process.spawn`. Same surface, faster on Bun + more ergonomic Promise/stream API. | `framework/phase-3/11-agents-md-generator`, `framework/13-conventions`, `cli/00-overview` |
| `Bun.$` (shell) | Bun-only | Closest: `zx` (Node lib by Google). `Bun.$` is built-in tagged-template shell with proper escaping. | `framework/phase-4/09-plugins`, `cli/04-deploy-command`, `framework/13-conventions` |
| `Bun.env` | Standard | `process.env`. Both Bun and Node auto-load `.env`; Next does too (framework-level). | `framework/phase-2/08-config`, `framework/13-conventions` |
| `Bun.inspect` | Standard | `util.inspect` on Node. | `framework/phase-0/03-render` (error formatting) |
| `Bun.openInEditor` | Bun-builtin | Closest: `open-editor` npm. | `framework/phase-0/03-render` |
| `Bun.escapeHTML` | Bun-builtin | `he` / `lodash.escape` on Node. | `framework/phase-0/03-render` |
| `Bun.deepEquals` | Bun-builtin | `node:assert.deepStrictEqual` / Jest matchers. | `framework/phase-1/14-testing` |
| `Bun.gzipSync` | Standard | `zlib.gzipSync` on Node. | `cli/03-build-command` (asset precompression in build output) |
| `Bun.argv` | Standard | `process.argv`. | `cli/00-overview`, `cli/01-entry` |
| `Bun.stdin` | Standard | `process.stdin`. | `cli/08-secret-command` (TTY hidden-input prompt for `patties secret set`) |
| `bun:test` (test/expect/mock/spyOn) | Bun-faster | Vitest / Jest / `node --test` (Node 20+ built-in). Bun's is in the runtime and starts fastest. | `framework/phase-1/14-testing` |
| `bun --watch` | Bun-faster | Node 22+ `--watch` (restart); Next dev (framework-managed). | `framework/00-overview`, `framework/phase-0/02b-filesystem-router`, `framework/phase-1/05-dev-hmr`, `framework/13-conventions` |
| `bunx` | Bun-faster | `npx` on Node. Bun's is materially faster. | `framework/phase-4/09-plugins`, `framework/phase-3/11-agents-md-generator`, `cli/05-create-patties` |
| `bun build` (CLI) | Bun-only | `next build` / `vite build` / `tsup`. Bun's is built into the runtime. | `cli/03-build-command`, `cli/05-create-patties` (build target enum `bun \| edge`) |
| `bun install` | Bun-faster | `npm` / `pnpm` / `yarn` install. Bun is materially faster + lockfile-deterministic. | `cli/05-create-patties` |
| `bun run` | Bun-faster | `npm run` / `pnpm run`. | `framework/phase-2/12-edge-adapters`, `cli/05-create-patties` |
| `bun test` (CLI) | Bun-faster | Vitest / Jest CLI / `node --test`. | `framework/phase-1/14-testing`, `cli/05-create-patties` |
| `Bun.FileSystemRouter` | Bun-builtin | Next App Router (framework-owned, not a primitive); SvelteKit / Remix similar. Bun exposes a router primitive — patties consciously rolls its own (deterministic ordering + `.tsx` vs `.ts` discrimination) on top. | `framework/phase-0/02b-filesystem-router` |
| `Bun.plugin` (loaders) | Bun-only | Webpack/Vite plugins are the closest abstraction; different shape. Bun's plugin runs in both build and runtime. | `framework/phase-4/09-plugins`; build loaders flow through `Bun.build`'s plugin slot. |

### RFC-later (backlog — useful, not blocking phases 0–4)

Every row below has a corresponding stub at `rfcs/backlog/rfc-bun-<slug>.md`. The stub holds the same Bun-unique / comparable / trigger metadata in YAML frontmatter so it can be promoted to `rfcs/draft/` and edited in place when the trigger fires.

| API | Bun-unique? | Comparable elsewhere | Trigger to pick up |
|---|---|---|---|
| `Bun.Transpiler` | Bun-faster | Next uses SWC (`@swc/core`) for on-demand transpile in `next dev`; Babel before SWC. | A feature needs sub-file transpile decoupled from bundling (REPL / eval endpoint). See [[rfc-bun-transpiler]]. |
| `Bun.ArrayBufferSink` | Bun-only | Node has no equivalent streaming buffer-builder. Current SSR uses `ReadableStream`. | SSR profiling shows allocation pressure from many small chunks. See [[rfc-bun-arraybuffersink]]. |
| `Bun.fileURLToPath` / `Bun.pathToFileURL` | Standard | `node:url.fileURLToPath` / `node:url.pathToFileURL` — same surface. | A spec needs to round-trip `import.meta.url` ↔ disk path (borderline out-of-scope). See [[rfc-bun-path-url]]. |
| `Bun.resolveSync` | Bun-faster | `import.meta.resolve` (Node 20+, sync in 22+); `require.resolve` for CJS. | Plugins need to resolve modules outside the build context. See [[rfc-bun-resolve-sync]]. |
| `Bun.deflateSync` / `Bun.zstdCompress*` | Bun-only for zstd; Standard for deflate | Next pre-compresses with gzip + brotli. Node 22+ has `zlib.zstdCompress` (recent). Cloudflare serves brotli + zstd. | Build output needs brotli/zstd variants for edge runtimes that prefer them. See [[rfc-bun-alt-compression]]. |
| `Bun.connect` / `Bun.listen` (TCP) | Bun-faster | `node:net`. Frameworks don't expose raw TCP. | Non-HTTP transport story emerges (borderline out-of-scope). See [[rfc-bun-tcp]]. |
| `Bun.udpSocket` | Bun-faster | `node:dgram`. | Same as TCP (borderline out-of-scope). See [[rfc-bun-udp]]. |
| `Bun.peek` | Bun-only | No standard Node equivalent — introspects Promise state synchronously. | Framework writes its own async coordinator (unlikely, borderline out-of-scope). See [[rfc-bun-peek]]. |
| `--bytecode` flag | Bun-only | **None as a user-facing build flag.** V8 has `code_cache` via experimental flags; Node has no end-user build-time bytecode toggle. | Cold-start benchmarks show JS parse time ≥ 20% of startup. See [[rfc-bun-bytecode]]. |
| `--smol` flag | Bun-only | Node's `--max-old-space-size` is the opposite knob (upper bound). | Memory-constrained deploy target (small Fly VMs, IoT edge) enters scope. See [[rfc-bun-smol]]. |

### Out-of-scope (not framework surface)

| API | Bun-unique? | Comparable elsewhere | Reason |
|---|---|---|---|
| `bun:ffi` | Bun-only | `node:ffi-napi` (community native addon). | Native interop; meta-framework should not surface. |
| `bun:jsc` | Bun-only | n/a — engine internals. | Engine internals. |
| `bun:internal` | Bun-only | n/a — private. | Private. |
| `Bun.dns` | Standard | `node:dns`. | Low-level; Bun does it transparently. |
| `Bun.mmap` | Bun-only | Node needs native addon (`@raygun-nickj/mmap-io`). | Too low-level for a meta-framework. |
| `Bun.allocUnsafe` | Bun-faster | `Buffer.allocUnsafe`. | Low-level. |
| `Bun.gc` / `Bun.generateHeapSnapshot` | Bun-builtin | `node:v8.getHeapSnapshot` / `--expose-gc`. | Diagnostic, not framework-facing. |
| `Bun.indexOfLine` | Bun-builtin | Trivial userland. | Niche string scan. |
| `Bun.concatArrayBuffers` | Bun-builtin | Trivial userland. | Trivial helper. |
| `Bun.readableStreamTo*` (7 variants) | Bun-builtin | Standard `Response` / stream coercion. | Use stream APIs directly; framework doesn't need to re-export. |
| `Bun.isMainThread` / `Bun.main` | Standard | `node:worker_threads.isMainThread`; `require.main === module`. | Worker plumbing — orthogonal. |
| `Bun.stdout` / `Bun.stderr` | Standard | `process.stdout` / `process.stderr`. | Standard process I/O — not a framework surface (CLI uses `console.*`). |
| `Bun.version` / `Bun.revision` | Standard | `process.version`. | Trivially available. |
| `Bun.isAwesome` | n/a | n/a — joke. | Joke API. |
| `Bun.Terminal` | Bun-only | `blessed` / `ink` on Node (TUI libs). | TUI primitive — not for SSR meta-framework. |
| `Bun.WebView` | Bun-only | Tauri / Electron / Wails (full apps, not built-in). | Desktop shell — not Patties' surface. |
| `Bun.gunzipSync` / `Bun.inflateSync` / `Bun.zstdDecompress*` | Standard for gunzip/inflate; Bun-only for zstd | `zlib.gunzipSync` etc. | Inverse direction of build-time compression; not currently needed. |
| `Bun.deepMatch` | Bun-builtin | Jest's `toMatchObject`; Vitest similar. | `expect.toMatchObject` already covers tests. |
| `--inspect` / `--print` | Standard | `node --inspect` / `node -p`. | Debugger / one-shot eval — dev tools, not framework. |
| `bun repl` / `bun upgrade` / `bun init` / `bun create` | Bun-faster | `node` REPL; `npm init` / `npm create`. | User-facing CLI; `cli/05-create-patties` owns scaffolding. |
| `bun:ws` / `bun:alpine` / `bun:debian` / `bun:distroless` / `bun:slim` / `bun:latest` | n/a | n/a — Docker tags. | Docker image tags — not modules. Caught by the `bun:*` grep; excluded from real surface. |
| `bun:after` / `bun:before` / `bun:bundle` / `bun:wrap` / `bun:invalidate` / `bun:pull` / `bun:error` | n/a | n/a — doc prose. | False positives — these are not Bun modules; they appear in docs prose. |

## Re-running this audit

```bash
# 1. Refresh raw text
mkdir -p agent_specs/research
curl -fsSL https://bun.com/llms-full.txt \
  -o agent_specs/research/bun-surface-raw.txt
# (fallback: https://bun.sh/llms-full.txt, then sitemap.xml)

# 2. Extract candidate APIs
cd agent_specs/research
grep -ohE 'Bun\.[A-Za-z_][A-Za-z0-9_]*' bun-surface-raw.txt | sort -u > _bun-globals.txt
grep -ohE 'bun:[a-z_][a-z0-9_]*'         bun-surface-raw.txt | sort -u > _bun-modules.txt
grep -ohE 'bun [a-z][a-z-]*'              bun-surface-raw.txt | sort | uniq -c | sort -rn > _bun-cli.txt

# 3. Cross-reference against specs (current layout: archived phase specs +
#    in-flight drafts under framework/draft/ and cli/draft/)
cd ..
grep -rohE '(Bun\.[A-Za-z_][A-Za-z0-9_]*|bun:[a-z_]+|bun --?[a-z-]+|HTMLRewriter)' \
  framework/archive/phase-*/*.md \
  framework/archive/00-overview.md framework/archive/13-conventions.md \
  framework/draft/*.md \
  cli/archive/*.md cli/draft/*.md \
  | sort | uniq -c | sort -rn

# 4. Re-classify entries → update this matrix
# 5. Diff against rfcs/{accepted,deferred,backlog}/rfc-bun-* — each RFC carries
#    Bun-unique / comparable / trigger metadata in YAML frontmatter that
#    must match the matrix row. Promote backlog → draft → accepted as
#    triggers fire. NOTE: restrict to the rfc-bun-* prefix — the rfc-patties-ui-*
#    family in the same dirs belongs to patties-ui-parity-matrix.md, not here.
ls agent_specs/rfcs/{accepted,backlog,deferred}/rfc-bun-*
```

Reviewer note: filter out the Docker-image and prose false-positives in the `bun:*` grep — only `bun:ffi`, `bun:jsc`, `bun:internal`, `bun:sqlite`, `bun:test` are real modules at the time of this audit. Also note the `rfcs/` tree is shared with the `rfc-patties-ui-*` family ([`patties-ui-parity-matrix.md`](./patties-ui-parity-matrix.md)); this matrix's counts and audit cover `rfc-bun-*` only.
