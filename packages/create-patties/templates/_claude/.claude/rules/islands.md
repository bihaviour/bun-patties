# Islands rule

The default rendering mode is server-side. Use **islands** for the
parts of a page that need browser-side interactivity (`useState`,
`useEffect`, event handlers).

- **Where they live:** `app/islands/*.tsx`. Files outside this
  directory are server-only and never ship to the browser.
- **How to mark one:** start the file with `"use client";` and
  default-export a React component. The framework will register it,
  bundle the client code, and inject the hydration script when the
  component is rendered from a route.
- **How to use one:** import the component from a route file:
  ```tsx
  import TodoApp from "../islands/TodoApp.tsx";

  export default function Index(): JSX.Element {
    return <main><TodoApp /></main>;
  }
  ```
- **Today's gap (`bun dev`):** dev mode SSRs the island but does not
  yet ship the client bundle. Click handlers are dead under `bun
  dev`. To exercise interactivity right now, run `bun run build &&
  bun start`. Full dev-mode hydration lands with framework spec 18.
- **Naming:** the island's auto-registered name is the file path
  relative to `app/islands/` with slashes replaced by dashes and the
  extension stripped (e.g. `app/islands/forms/Signup.tsx` →
  `forms-Signup`). Default exports are the only export consulted.
- **Don't put non-island helpers in `app/islands/`.** Every `.tsx`
  in there is treated as a hydratable component. Put shared
  presentational components in `app/components/` or co-locate them
  under a `_` prefix.
