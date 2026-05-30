Create a new Patties route.

Rules from CLAUDE.md:
- Page routes live in app/routes/ as .tsx files.
- API routes live in app/routes/api/ as .ts files exporting GET/POST/PUT/DELETE.
- Dynamic segments use [param].tsx; catch-alls use [...rest].tsx.

User intent: $ARGUMENTS

Decide whether the user wants a page or an API route based on the path and intent.
Create the file. Show me the diff. Do not run the dev server.
