import type { ComponentType } from "react";
import * as React from "react";
import { hydrateRoot } from "react-dom/client";

export interface PattiesClient {
	register(name: string, component: ComponentType<any>): void;
	hydrateAll(): void;
}

export function createClient(): PattiesClient {
	const components: Record<string, ComponentType<any>> = {};

	return {
		register(name, component) {
			components[name] = component;
		},
		hydrateAll() {
			const markers = document.querySelectorAll<HTMLElement>("[data-island]");
			markers.forEach((marker) => {
				const name = marker.getAttribute("data-island");
				if (!name) return;
				const Component = components[name];
				if (!Component) {
					console.error("[patties] unknown island:", name);
					return;
				}
				let props: Record<string, unknown> = {};
				const propsTag = marker.nextElementSibling;
				if (
					propsTag &&
					(propsTag as Element).matches?.(
						`script[data-props][data-for="${name}"]`,
					)
				) {
					try {
						props = JSON.parse(propsTag.textContent || "{}");
					} catch (e) {
						console.error(`[patties] island props parse for '${name}':`, e);
					}
				}
				try {
					hydrateRoot(marker, React.createElement(Component, props));
				} catch (e) {
					console.error(`[patties] hydrate failed for island '${name}':`, e);
				}
			});
		},
	};
}
