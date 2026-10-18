// Shared by the SSR renderer and the browser runtime, so it must stay free of
// DOM, Bun and React imports.

export const BOOTSTRAP_ID = "__patties_bootstrap";

// Request header the client navigator sets to ask for the route's bootstrap
// payload as JSON instead of an HTML document.
export const NAV_HEADER = "x-patties-nav";

export interface BootstrapPayload {
	params: Record<string, string>;
	// Present only when the page exports `loader()`. Already passed through the
	// page's `serialize` hook, so it is plain JSON.
	data?: unknown;
}

// Answer to a navigation request. `hydrated: false` tells the client to fall
// back to a full document load (the target route ships no page bundle).
export type NavPayload =
	| {
			hydrated: true;
			route: string;
			script: string;
			bootstrap: BootstrapPayload;
			title?: string;
	  }
	| { hydrated: false };

export function encodeBootstrap(payload: BootstrapPayload): string {
	return JSON.stringify(payload);
}

// Rebuild the props the server rendered the page with. `deserialize` is the
// page's optional hook for non-JSON types (Date, Map, …).
export function bootstrapProps(
	payload: BootstrapPayload,
	deserialize?: (data: unknown) => unknown,
): Record<string, unknown> {
	const props: Record<string, unknown> = { ...payload.params };
	if ("data" in payload) {
		props.data = deserialize ? deserialize(payload.data) : payload.data;
	}
	return props;
}
