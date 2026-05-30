# Build-time discovery rule

Route and island discovery happens at **build time**, not at request time.

- `src/build/` scans routes and islands, generates client + server entries, and writes a manifest.
- The production server bundle must contain the route table inlined — it must not call `scanRoutes` / `scanIslands` / `Bun.Glob` at runtime.
- Integration tests under `tests/integration/build.test.ts` assert this. If your change causes them to fail, the fix is to move discovery back into the build, not to relax the test.

Dev mode is the exception: the dev server may re-scan on file change to drive HMR.
