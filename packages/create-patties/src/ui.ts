// Patties UI starter integration (spec 18 §Patties UI).
//
// create-patties stays zero-dependency and offline, so instead of shelling out
// to `patties ui init` + `patties add` (which need the project's installed
// binary) we vendor the starter set under templates/ui-starter/ and copy it
// directly. The vendored copies are byte-for-byte identical to
// packages/patties-ui/templates/ — a drift test enforces that — so this is
// equivalent to what `patties add button card input label` would stamp.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Theme } from "./prompts.ts";

// Runtime peer deps the starter components + _internal helpers import.
// Derived from packages/patties-ui/src/registry.ts entries for the starter set:
//   button → cn + cva, card → cn, input → cn, label → cn + @radix-ui/react-label
export const UI_DEPS: Record<string, string> = {
	"@radix-ui/react-label": "^2.1.0",
	"class-variance-authority": "^0.7.0",
	clsx: "^2.1.0",
	"tailwind-merge": "^2.5.0",
};

// Dev-only: the catalog the user runs `patties add` / `patties ui` against.
export const UI_DEV_DEPS: Record<string, string> = {
	"patties-ui": "latest",
};

const STARTER_COMPONENTS = ["button", "card", "input", "label"] as const;

// Stamp the vendored starter set into an app directory and rewrite the demo to
// import the stamped components. `uiStarterDir` is templates/ui-starter.
export async function applyUiStarter(
	appRoot: string,
	theme: Theme,
	uiStarterDir: string,
): Promise<void> {
	const uiDir = `${appRoot}/app/components/ui`;
	const internalDir = `${uiDir}/_internal`;
	const stylesDir = `${appRoot}/app/styles`;
	await Bun.$`mkdir -p ${internalDir} ${stylesDir}`.quiet();

	for (const name of STARTER_COMPONENTS) {
		await Bun.$`cp ${uiStarterDir}/${name}.tsx ${uiDir}/${name}.tsx`.quiet();
	}
	await Bun.$`cp -R ${uiStarterDir}/_internal/. ${internalDir}`.quiet();

	const themeTokens = resolve(uiStarterDir, "themes", theme, "tokens.css");
	const tokens = existsSync(themeTokens)
		? themeTokens
		: resolve(uiStarterDir, "tokens.css");
	await Bun.$`cp ${tokens} ${stylesDir}/tokens.css`.quiet();
	// app.css is written (not vendored) because a committed `@theme` stylesheet
	// would trip this repo's Biome CSS parser, which has Tailwind directives off.
	await Bun.write(`${stylesDir}/app.css`, APP_CSS);

	// Demo page + island that import the stamped components. Only applies to
	// frontend / fullstack, which always have app/routes + app/islands.
	await Bun.$`cp ${uiStarterDir}/demo/index.tsx ${appRoot}/app/routes/index.tsx`.quiet();
	await Bun.$`cp ${uiStarterDir}/demo/TodoApp.tsx ${appRoot}/app/islands/TodoApp.tsx`.quiet();
}

// Pre-wired Tailwind v4 + tokens stylesheet (the wiring `patties ui init`
// prints). Patties does not bundle Tailwind — compile this with the Tailwind
// CLI; see the generated README "Styling" section.
const APP_CSS = `@import "tailwindcss";
@import "./tokens.css";

@theme inline {
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-card: var(--card);
	--color-card-foreground: var(--card-foreground);
	--color-popover: var(--popover);
	--color-popover-foreground: var(--popover-foreground);
	--color-primary: var(--primary);
	--color-primary-foreground: var(--primary-foreground);
	--color-secondary: var(--secondary);
	--color-secondary-foreground: var(--secondary-foreground);
	--color-muted: var(--muted);
	--color-muted-foreground: var(--muted-foreground);
	--color-accent: var(--accent);
	--color-accent-foreground: var(--accent-foreground);
	--color-destructive: var(--destructive);
	--color-destructive-foreground: var(--destructive-foreground);
	--color-border: var(--border);
	--color-input: var(--input);
	--color-ring: var(--ring);
	--radius-lg: var(--radius);
	--radius-md: calc(var(--radius) - 2px);
	--radius-sm: calc(var(--radius) - 4px);
}
`;
