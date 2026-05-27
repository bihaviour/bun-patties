# Filesystem routing rule

Routes are discovered from the filesystem under `app/routes/`. Path
conventions:

| File | URL |
|---|---|
| `app/routes/index.tsx` | `/` |
| `app/routes/about.tsx` | `/about` |
| `app/routes/hotels/index.tsx` | `/hotels` |
| `app/routes/hotels/[city].tsx` | `/hotels/:city` |
| `app/routes/api/revenue.ts` | `/api/revenue` |
| `app/routes/_internal.tsx` | (private — never routed) |

- **Page routes** are `.tsx` files that default-export a React
  component. The component receives no props by default; read params
  / cookies / env from `PattiesContext` via the page's optional
  `loader` (export `loader` if you need server-side data).
- **API routes** are `.ts` files that export named HTTP-method handlers:
  `GET`, `POST`, `PUT`, `DELETE`, `PATCH`. They return a standard
  `Response`. Default exports in `.ts` files are reserved and will
  error.
- **Dynamic segments** use `[param]` in the filename. The values land
  in `ctx.params`.
- **Files starting with `_`** are private — co-located helpers,
  components, or test files. They are never routed.
- **Reserved URL prefixes:** `/__patties_*` and `/_patties/*` are
  framework-owned. Don't put your own routes under them.
- **Discovery happens at build time.** The production server bundle
  has the route table inlined; it does not call `Bun.Glob` at runtime.
  Dev mode re-scans on file change (that's where HMR comes from).
