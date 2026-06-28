---
spec: framework/18-dev-island-bundler-impl
title: Dev island bundler — implementation
status: draft
phase: dev-dx
file: src/dev/bundler.ts (new), src/dev/watcher.ts, src/dev/index.ts, src/cli/dev.ts, src/render/index.tsx, src/render/dev-error.tsx, packages/create-patties/templates/default/
last_reviewed: 2026-05-27
depends_on:
  - framework/17-dev-island-bundler (accepted)
  - cli/09-create-patties-dx (template consumes the bundler handle)
related_rfcs:
  - rfc-bun-htmlrewriter (accepted, encoded by this spec — script injection)
  - rfc-bun-import-attributes (encoded; explains the dev/prod manifest divergence below)
  - rfc-bun-html-imports (deferred; re-evaluation trigger noted in spec 17)
---

# Spec 18 — Dev island bundler implementation

Implements the design decided in spec 17:

- **A2′** eager startup pre-bundle + lazy rebuild on chunk GET
- **B1** on disk under `<appDir>/.patties-dev/client/`
- **C1** CLI owns the lifecycle
- **D** `/_patties/client/` URLs, stable filenames, `Cache-Control: no-store`

This spec is the buildable plan. The intent is that a single PR can land
the whole thing.

## Existing pieces to reuse

- `src/build/scan-islands.ts` → `scanIslands(appDir)` returns
  `IslandEntry[]`. Use as-is.
- `src/build/client-entry.ts` → `generateClientEntry(islands, { frameworkRoot })`
  returns the entry module source. Use as-is.
- `src/build/index.ts` → `resolveFrameworkRoot()` already exists (private).
  Lift it to a shared `src/internal/framework-root.ts` so `src/dev/`
  can import it without depending on `src/build/`.
- `src/dev/watcher.ts` → already publishes `{ type: "update", island }`
  on changes under `app/islands/`.
- `src/render/index.tsx` → `createRenderer({ manifest })` already accepts
  a `ClientManifest`. No shape change required.
- `src/server/index.ts` → `startServer({ staticRoutes })` already exists
  and is what the bundler's chunk routes will piggyback on.

## New module: `src/dev/bundler.ts`

### Public API

```ts
import type { ClientManifest } from "../render/index.tsx";

export interface DevBundlerOptions {
  appDir: string;
}

export interface DevBundlerHandle {
  /** Live reference. Renderer reads this on each render; we mutate in place. */
  readonly manifest: ClientManifest;

  /** Route table keyed by URL. Pass into startServer({ staticRoutes }). */
  readonly staticRoutes: Record<string, (req: Request) => Promise<Response>>;

  /** Mark the bundle dirty. Cheap; does not trigger a build. */
  markDirty(): void;

  /** Most recent build error, if any. Cleared on the next successful build. */
  lastError(): BuildError | null;

  /** Tear down the in-memory state and remove `<appDir>/.patties-dev/`. */
  dispose(): Promise<void>;
}

export interface BuildError {
  message: string;
  logs: string[];
}

export async function startDevBundler(opts: DevBundlerOptions): Promise<DevBundlerHandle>;
```

Re-exported from `src/dev/index.ts` as `startDevBundler` and the two
types.

### Internal state

```ts
interface State {
  appDir: string;
  outDir: string;          // `${appDir}/.patties-dev/client`
  entrySrcPath: string;    // `${appDir}/.patties-dev/client-entry.ts`
  manifest: ClientManifest;
  staticRoutes: Record<string, (req: Request) => Promise<Response>>;
  dirty: boolean;
  inFlight: Promise<void> | null;
  lastError: BuildError | null;
}
```

We rebuild the entire client bundle on dirty (not per-island). Reasons:

- `Bun.build` is fast enough that per-island is premature optimization.
- The production pipeline produces a single entry + split chunks via
  `splitting: true`; matching that shape in dev keeps the renderer
  contract identical between dev and prod.
- Per-island would require either disabling splitting (worse output) or
  running N parallel `Bun.build` calls (harder to reason about).

### Startup flow

```ts
export async function startDevBundler(opts): Promise<DevBundlerHandle> {
  const outDir = `${opts.appDir}/.patties-dev/client`;
  const entrySrcPath = `${opts.appDir}/.patties-dev/client-entry.ts`;

  await Bun.$`mkdir -p ${outDir}`.quiet();

  const state: State = {
    appDir: opts.appDir,
    outDir,
    entrySrcPath,
    manifest: { entry: null, islands: {} },
    staticRoutes: {},
    dirty: false,
    inFlight: null,
    lastError: null,
  };

  await rebuild(state);          // eager pre-bundle (A2′)
  wireStaticRoutes(state);       // installs /_patties/client/* handler

  return {
    get manifest() { return state.manifest; },
    get staticRoutes() { return state.staticRoutes; },
    markDirty() { state.dirty = true; },
    lastError() { return state.lastError; },
    dispose() { return disposeBundler(state); },
  };
}
```

### `rebuild(state)`

```ts
async function rebuild(state: State): Promise<void> {
  if (state.inFlight) return state.inFlight;          // coalesce concurrent callers
  state.inFlight = (async () => {
    try {
      const islands = await scanIslands(state.appDir);
      const frameworkRoot = resolveFrameworkRoot();
      await Bun.write(state.entrySrcPath, generateClientEntry(islands, { frameworkRoot }));

      const result = await Bun.build({
        entrypoints: [state.entrySrcPath],
        target: "browser",
        splitting: true,
        sourcemap: "linked",
        minify: false,
        outdir: state.outDir,
        // Stable names. Dev uses Cache-Control: no-store so no need to hash.
        naming: { entry: "[name].js", chunk: "[name].js", asset: "[name].[ext]" },
      });

      if (!result.success) {
        state.lastError = {
          message: "client bundle failed",
          logs: result.logs.map((l) => l.message ?? String(l)),
        };
        return;
      }

      updateManifest(state.manifest, result.outputs, state.entrySrcPath, islands, state.outDir);
      state.dirty = false;
      state.lastError = null;
    } finally {
      state.inFlight = null;
    }
  })();
  return state.inFlight;
}
```

`updateManifest` is a near-copy of `populateClientManifest` from
`src/build/index.ts`. Lift the latter to a shared
`src/internal/client-manifest.ts` and call it from both places — do
**not** copy-paste.

### `wireStaticRoutes(state)`

Installs handlers under `/_patties/client/*` that:

1. If dirty, `await rebuild(state)` first. Concurrent GETs coalesce on
   the shared `inFlight` promise.
2. Read the requested file from `state.outDir` with `Bun.file()`.
3. Return with `Content-Type` inferred from extension and
   `Cache-Control: no-store`.
4. If the file does not exist, return 404.

We register a single wildcard route, not one route per chunk. The
existing `startServer({ staticRoutes })` API only takes a flat map; we
work around that by registering a function under a synthetic pattern
that the Bun matcher treats as a wildcard. **Concrete shape TBD by the
implementer** — if `startServer` needs an extension, add an optional
`wildcardRoutes?: Record<string, Handler>` field rather than overloading
`staticRoutes` semantics.

### `dispose(state)`

- Awaits any in-flight build.
- Clears `state.staticRoutes`.
- `rm -rf` on `${appDir}/.patties-dev/`. Use Bun's
  `await Bun.$\`rm -rf ${path}\`.quiet()`.
- Wired to `process.on("SIGINT" | "SIGTERM")` via the existing
  `installSigintHandler` in `src/cli/log.ts`. The CLI calls
  `bundler.dispose()` from inside the SIGINT handler before exiting.

## Watcher changes

`src/dev/watcher.ts`:

```ts
export interface DevOptions {
  appDir: string;
  bundler?: DevBundlerHandle;   // new, optional
}
```

In the existing `notifyChange(path)`:

```ts
if (path.startsWith(islandsDir)) {
  options.bundler?.markDirty();             // ← new, synchronous, cheap
  const rel = path.slice(islandsDir.length);
  const name = rel.replace(/\.[tj]sx?$/, "").replace(/\//g, "-");
  publish(JSON.stringify({ type: "update", island: name }));
  return;
}
```

Order matters: mark dirty **before** publishing the WS message so a
fast-acting browser cannot GET the chunk before the dirty flag is set.

## CLI wiring

`src/cli/dev.ts`, in `bootstrap()`:

```ts
const bundler = await startDevBundler({ appDir: resolved.appDir });
const devServer = createDevServer({ appDir: resolved.appDir, bundler });

// install dispose on shutdown
const sigint = installSigintHandler();   // assume returns a hook list
sigint.push(() => bundler.dispose());

// ...existing plugin onDevStart loop...

const entry = findUserEntry(resolved.appDir);
if (entry) {
  const mod = await import(entry);
  const start = mod.default as StartFn | undefined;
  if (typeof start === "function") {
    await start({
      devServer,
      port: resolved.port,
      host: resolved.host,
      appDir: resolved.appDir,
      bundler,                              // ← new field
    });
    printReady(resolved);
    return EXIT.OK;
  }
  log.warn(`${entry} has no default export; starting a stub dev server.`);
}

// Stub fallback unchanged — does NOT get the bundler.
```

The `StartFn` signature in `src/cli/dev.ts` gains an optional `bundler`:

```ts
type StartFn = (opts: {
  devServer: DevServer;
  port: number;
  host: string;
  appDir: string;
  bundler?: DevBundlerHandle;
}) => void | Promise<void>;
```

Optional so user-authored `server.ts` files written before this spec
continue to compile and run (without hydrated islands — same as today).

`installSigintHandler` today is fire-and-forget; if it doesn't already
expose a way to register additional cleanups, extend it to do so as part
of this PR.

## Renderer changes

This spec also pulls forward the HTMLRewriter work decided in
[[rfc-bun-htmlrewriter]] (accepted Phase 2, not yet encoded). The dev
bundler needs a `<script src="/_patties/client/client-entry.js">` tag
injected into the SSR HTML. Today `src/render/index.tsx` does that
with string concatenation against `</body>`. Spec 18 replaces that with
an `HTMLRewriter` pipeline, because:

- The dev bundler is now a second customer for the same injection point
  (the HMR client script is the first). Two string-concat callers in
  the same render path is the moment to factor.
- The RFC's reasoning stands unchanged: string-concat against minified
  shells is fragile, and the rewriter ships unchanged to Cloudflare /
  workerd via the edge adapter (spec 12).
- The CSRF auto-injection in [[rfc-bun-csrf]] depends on the rewriter
  landing first; doing it here unblocks that work too.

Implementation:

1. New `src/render/inject.ts` exporting `createInjector(scripts:
   string[]) → (res: Response) => Response`. Uses `HTMLRewriter` with a
   single `element("body", { element(el) { el.append(scriptTags, {
   html: true }) } })` handler.
2. `src/render/index.tsx` constructs an injector per render with the
   appropriate scripts (HMR client in dev, plus the client-entry tag
   when `manifest.entry` is set).
3. Remove `BODY_CLOSE_RE` and the string-injection branch.
4. Existing unit tests under `tests/render/` that asserted on the
   concatenated string update to read the rewritten body. (Cheaper:
   buffer the rewritten Response in the test, assert on the result.)

`src/render/dev-error.tsx` gains an optional "current build error"
input. `src/render/index.tsx` plumbs it through:

```ts
export interface RenderOptions {
  manifest?: ClientManifest;
  dev?: boolean;
  modules?: Record<string, unknown>;
  /** new: function returning the most recent dev build error, if any */
  getBuildError?: () => BuildError | null;
}
```

In `renderPage`, before normal rendering: if `dev && getBuildError()`
returns non-null, short-circuit to `renderDevErrorPage` with that error
instead of rendering the page. This makes broken island edits visible
on the next navigation without crashing the server.

The template's `app/server.ts` passes `getBuildError: () =>
opts.bundler?.lastError() ?? null`.

## Template changes (handed off to CLI spec 09)

`packages/create-patties/templates/default/` updates:

1. `gitignore` — add `.patties-dev/`.
2. `app/server.ts` — consume the bundler:

```ts
import type { DevBundlerHandle, DevServer } from "patties/dev";
import { createRenderer } from "patties/render";
import { createRouter } from "patties/router";
import { startServer } from "patties/server";

interface StartOpts {
  devServer: DevServer;
  port: number;
  host: string;
  appDir: string;
  bundler?: DevBundlerHandle;
}

export default async function start(opts: StartOpts): Promise<void> {
  const renderer = createRenderer({
    dev: true,
    manifest: opts.bundler?.manifest,
    getBuildError: () => opts.bundler?.lastError() ?? null,
  });
  const router = await createRouter({ appDir: opts.appDir, renderer });
  startServer({
    port: opts.port,
    hostname: opts.host,
    dev: true,
    devServer: opts.devServer,
    routes: router.routes,
    fallback: router.fallback,
    staticRoutes: opts.bundler?.staticRoutes,
  });
}
```

3. The `app/server.ts` I added in PR-current already exists in a thinner
   form; this spec replaces it.

## Dev/prod manifest divergence (clarification)

The macro policy decided in [[rfc-bun-import-attributes]] lists *"Client
manifest (island name → chunk URL)"* as a required macro: the production
server bundle reads the manifest at build time via `MANIFEST` and never
at runtime. This spec deliberately diverges in dev:

- Dev mutates `state.manifest` in place across rebuilds; the renderer
  holds the live reference and reads it on each render.
- The `MANIFEST` macro is **not** used in the dev path.

This is consistent with the build-time-discovery rule because the
production server bundle still goes through `src/build/index.ts` →
`generateServerEntry` → MANIFEST macro. The dev bundler lives entirely
under `src/dev/` and is import-disjoint from the production bundle (see
the guard test below).

Document this divergence in `src/dev/bundler.ts` with a one-line header
comment referencing the RFC, so the next person reading the code
understands why this dev path looks unlike the prod path.

## Build-time-discovery guard

Production server bundle must not import `src/dev/bundler.ts`. Enforce
with a new test in `tests/integration/build.test.ts`:

```ts
test("production server bundle does not reference src/dev/", async () => {
  const built = await fs.promises.readFile(serverEntryArtifact, "utf8");
  expect(built).not.toMatch(/startDevBundler/);
  expect(built).not.toMatch(/\.patties-dev/);
});
```

Also add a static import-graph check (CI grep): no file under
`src/server/**` or `src/build/**` may `import` anything under `src/dev/`.
A shell one-liner is enough; wire it into `bun run validate`.

## Test plan

### Unit — `tests/dev/bundler.test.ts` (new)

Fixture: minimal app under `tests/fixtures/dev-bundler/` with one island
`app/islands/Counter.tsx`.

1. `startDevBundler({ appDir: fixture })` populates `manifest.entry`
   and `manifest.islands["Counter"]` with non-null URLs.
2. `Bun.file(${outDir}/client-entry.js).exists()` is true after startup.
3. `markDirty()` does not block, does not trigger I/O — verified by
   mocking `Bun.build` to count calls (one call from startup).
4. Calling the static route handler for the entry URL after
   `markDirty()` triggers exactly one rebuild even if invoked
   concurrently 10x (coalescing assertion).
5. Editing the island file (`Bun.write` with broken syntax) +
   `markDirty()` + GET → response is still 200 with stale content,
   `lastError()` returns the build error.

### Integration — `tests/integration/dev-hmr.test.ts` (extend)

Add after the existing reload test:

1. Boot `patties dev` against a fixture with one island.
2. GET `/` → assert response HTML contains
   `<script src="/_patties/client/client-entry.js"`.
3. GET that URL → 200, `Content-Type: text/javascript`,
   `Cache-Control: no-store`, body contains the island name.
4. Touch the island file with `Bun.write`. Wait for the WS message.
   GET the URL again → still 200, body reflects the new contents.

### Integration — `tests/integration/build.test.ts` (extend)

Add the production-bundle guard test described under
_Build-time-discovery guard_.

### Manual

`bunx create-patties demo && cd demo && bun dev` → load `/` → the demo
todo island responds to clicks without `patties build` having ever run.

## Migration / compatibility

- `StartFn` gains an optional `bundler` field. Existing user
  `server.ts` files written before this spec continue to compile and
  run; they just don't hydrate islands (same as today). The
  `create-patties` template is updated so new projects get the wiring
  by default.
- `createRenderer` gains an optional `getBuildError`. Existing callers
  are unaffected.
- `createDevServer` gains an optional `bundler`. Existing callers are
  unaffected.
- No public-export changes beyond the two new symbols
  (`startDevBundler`, `DevBundlerHandle`) on `patties/dev`.

## Risks / open in implementation

1. **`startServer` static-routes shape.** Today `staticRoutes` is
   `Record<string, Response>` — a flat map of URL → fixed response.
   Our bundler needs **per-request functions** (so we can check the
   dirty flag). Three options for the implementer:
   - Extend `ServerOptions` with `staticRoutes` accepting `Response |
     ((req: Request) => Promise<Response>)`. Tightest fit; keeps one
     field.
   - Add a new `wildcardRoutes` field. Cleanest separation; one more
     field on `ServerOptions`.
   - Have the bundler pre-write all chunk Responses and re-publish on
     rebuild. Defeats the lazy-rebuild design — rejected.
   Recommend the first; the type widening is backwards-compatible.

2. **Race between scan and write.** If the user saves an island file
   mid-rebuild, `scanIslands` runs against a transient FS state. Bun's
   FS is synchronous within the build, so the risk is limited to the
   user actively editing during the build window (sub-second). If it
   bites, debounce in the watcher (50ms).

3. **Sourcemap URLs.** Bun emits `//# sourceMappingURL=…` relative to
   the chunk. Because chunks and maps live in the same `outDir` served
   under the same prefix, the default relative URL should resolve.
   Verify in the integration test by curling the sourcemap URL.

4. **AGENTS.md mention.** `.patties-dev/` should be excluded from
   `agents-md` scan if that scan ever walks user dirs. Today it
   doesn't, but flag it for `src/agents-md/generate.ts` review.

## Acceptance criteria

- `bunx create-patties demo && cd demo && bun dev` serves a page where
  islands hydrate and respond to input, without `patties build` ever
  running.
- Editing an island file marks the bundle dirty without triggering a
  build; the build only runs when the browser re-fetches the chunk
  URL after the HMR notification.
- `patties build` artifacts are byte-for-byte unchanged by this spec
  (same `src/build/` code path).
- Production server bundle contains zero references to `src/dev/` or
  `.patties-dev`; the new integration test asserts both.
- `bun run validate` passes including the new import-graph guard.
- SIGINT during `patties dev` removes the `.patties-dev/` directory
  before exit.
- Script injection in `src/render/index.tsx` uses `HTMLRewriter` rather
  than string concatenation (encodes [[rfc-bun-htmlrewriter]]); flip
  that RFC's `status:` from `encoded_in: []` to include
  `framework/draft/18-dev-island-bundler-impl` once this lands.
