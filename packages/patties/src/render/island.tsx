import type * as React from "react";

export interface IslandProps {
	// Registered island name (matches the file in `app/islands/`).
	name: string;
	// JSON-serializable props passed to the client component on hydrate.
	props?: Record<string, unknown>;
	// Pre-rendered SSR output of the island component. Required so SSR HTML
	// matches what `hydrateRoot` will render — otherwise React logs a
	// hydration-mismatch warning and discards the SSR tree.
	children?: React.ReactNode;
}

// Renders the marker + props blob the client runtime (`createClient().hydrateAll()`)
// looks for. Layout:
//   <div data-island="<name>">…SSR output…</div>
//   <script type="application/json" data-props data-for="<name>">{"…":…}</script>
//
// The script must be the marker's `nextElementSibling` — that's how the
// runtime locates it via `matches('script[data-props][data-for="<name>"]')`.
export function Island({ name, props, children }: IslandProps) {
	// `<` is the only character that can break out of a <script> raw-text element.
	// React escapes it inside text children to `<`, which JSON.parse accepts.
	const json = JSON.stringify(props ?? {});
	return (
		<>
			<div data-island={name}>{children}</div>
			<script type="application/json" data-props data-for={name}>
				{json}
			</script>
		</>
	);
}
