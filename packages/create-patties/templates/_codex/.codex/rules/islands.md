# Islands rule

The default rendering mode is server-side. Use **islands** for the
parts of a page that need browser-side interactivity (`useState`,
`useEffect`, event handlers).

- **Where they live:** `app/islands/*.tsx`. Files outside this
  directory are server-only and never ship to the browser.
- **How to mark one:** start the file with `"use client";` and
  default-export a React component. The framework auto-registers it,
  bundles its client code, and serves the chunk under
  `/_patties/client/*` (in dev via `setupDevClient`; in production via
  `patties build`).
- **How to use one:** import the component from a route file and
  wrap each use-site in `<Island name="…">…</Island>` from
  `patties/render`. The wrapper emits the `data-island` marker + props
  sibling that the client runtime scans for — without it the markup
  SSRs fine but never hydrates.

  ```tsx
  import { Island } from "patties/render";
  import TodoApp from "../islands/TodoApp.tsx";

  export default function Index() {
    return (
      <main>
        <Island name="TodoApp">
          <TodoApp />
        </Island>
      </main>
    );
  }
  ```
- **Naming:** the island's auto-registered name is the file path
  relative to `app/islands/` with slashes replaced by dashes and the
  extension stripped (e.g. `app/islands/forms/Signup.tsx` →
  `forms-Signup`). Pass the same string as `<Island name="…">`. Default
  exports are the only export consulted.
- **Dev mode hydrates.** `patties dev` builds islands in
  `--mode development` (no minify), serves them, and the client runtime
  hydrates each `[data-island]` marker. HMR reloads the page on island
  changes.
- **Don't put non-island helpers in `app/islands/`.** Every `.tsx`
  in there is treated as a hydratable component. Put shared
  presentational components in `app/components/` or co-locate them
  under a `_` prefix.
