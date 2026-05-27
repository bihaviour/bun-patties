import type { ReactElement } from "react";
import { renderStatic } from "./render-static.ts";

let domReady = false;

async function ensureDom(): Promise<void> {
	if (domReady) return;
	if (typeof document === "undefined") {
		const { GlobalRegistrator } = await import("@happy-dom/global-registrator");
		GlobalRegistrator.register();
	}
	domReady = true;
}

export async function teardownDom(): Promise<void> {
	if (!domReady) return;
	const { GlobalRegistrator } = await import("@happy-dom/global-registrator");
	await GlobalRegistrator.unregister();
	domReady = false;
}

export interface HydrateResult {
	container: HTMLElement;
	html: string;
	hydratedHtml: string;
	textContent: string;
	errors: string[];
}

export async function hydrate(node: ReactElement): Promise<HydrateResult> {
	await ensureDom();
	const html = await renderStatic(node);
	const container = document.createElement("div");
	container.innerHTML = html;
	document.body.appendChild(container);

	const errors: string[] = [];
	const originalError = console.error;
	console.error = (...args: unknown[]) => {
		errors.push(args.map((a) => String(a)).join(" "));
	};
	let hydratedHtml = "";
	let textContent = "";
	try {
		const { hydrateRoot } = await import("react-dom/client");
		const root = hydrateRoot(container, node);
		await new Promise((r) => setTimeout(r, 0));
		hydratedHtml = container.innerHTML;
		textContent = container.textContent ?? "";
		root.unmount();
		await new Promise((r) => setTimeout(r, 0));
	} finally {
		console.error = originalError;
	}
	return { container, html, hydratedHtml, textContent, errors };
}
