import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import type { PattiesContext, RouteEntry } from "../types.ts";
import { renderDevErrorPage } from "./dev-error.tsx";
import { defaultHead, type MetaInput, renderMetaTags } from "./meta.tsx";
import { Shell } from "./shell.tsx";

export { Island, type IslandProps } from "./island.tsx";

import { HMR_CLIENT_SCRIPT } from "../internal/hmr-client.ts";

export interface ClientManifest {
	// URL of the synthetic island-registration entry; null when project has zero islands.
	entry?: string | null;
	// Island name → bundled chunk URL. Populated by the build module.
	islands?: Record<string, string>;
	// Legacy lookup (page-route bunPattern → script URL). Kept for callers that
	// still drive the renderer without going through `build()`.
	byEntry?: Record<string, string>;
}

export interface RenderOptions {
	manifest?: ClientManifest;
	dev?: boolean;
	// Pre-imported page modules keyed by entry.filePath. When provided, used instead of `await import(entry.filePath)`.
	modules?: Record<string, unknown>;
}

export interface Renderer {
	renderPage(
		entry: RouteEntry,
		req: Request,
		ctx: PattiesContext,
	): Promise<Response>;
}

const HMR_TAG_BYTES = new TextEncoder().encode(
	`<script>${HMR_CLIENT_SCRIPT}</script>`,
);
const BODY_CLOSE_RE = /<\/body>/i;

export function createRenderer(options: RenderOptions = {}): Renderer {
	const { manifest, dev = false, modules } = options;

	return {
		async renderPage(entry, req, ctx) {
			try {
				const mod = (modules?.[entry.filePath] ??
					(await import(entry.filePath))) as {
					default?: unknown;
					meta?: MetaInput;
					head?: () => React.ReactNode;
				};

				const Page = mod.default;
				if (typeof Page !== "function") {
					throw new Error(
						`Page module ${entry.filePath} has no default-exported component`,
					);
				}

				const headNodes: React.ReactNode[] = [];
				if (mod.meta) {
					headNodes.push(...renderMetaTags(mod.meta));
				} else if (!mod.head) {
					headNodes.push(...defaultHead(ctx.url.pathname));
				} else {
					// head() but no meta — still emit charset/viewport defaults.
					headNodes.push(
						<meta key="charset" charSet="utf-8" />,
						<meta
							key="viewport"
							name="viewport"
							content="width=device-width, initial-scale=1"
						/>,
					);
				}
				if (mod.head) {
					headNodes.push(
						<React.Fragment key="user-head">{mod.head()}</React.Fragment>,
					);
				}

				const clientScriptUrl =
					manifest?.byEntry?.[entry.bunPattern] ?? manifest?.entry ?? undefined;

				const tree = (
					<Shell headNodes={headNodes} clientScriptUrl={clientScriptUrl}>
						{React.createElement(Page as React.FC, { ...ctx.params })}
					</Shell>
				);

				const reactStream = await renderToReadableStream(tree, {
					onError(error) {
						if (dev) console.error("[patties] render error:", error);
					},
				});

				const combined = composeStream(reactStream, dev);

				return new Response(combined, {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			} catch (err) {
				if (dev) return renderDevErrorPage(err);
				return new Response("Internal Server Error", { status: 500 });
			}
		},
	};
}

function composeStream(
	reactStream: ReadableStream<Uint8Array>,
	dev: boolean,
): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			const reader = reactStream.getReader();
			const decoder = new TextDecoder();
			const encoder = new TextEncoder();
			let buffered = "";
			let injected = false;

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (!dev || injected) {
						if (buffered) {
							controller.enqueue(encoder.encode(buffered));
							buffered = "";
						}
						controller.enqueue(value);
						continue;
					}
					buffered += decoder.decode(value, { stream: true });
					if (BODY_CLOSE_RE.test(buffered)) {
						const withInjection = buffered.replace(
							BODY_CLOSE_RE,
							`<script>${HMR_CLIENT_SCRIPT}</script></body>`,
						);
						controller.enqueue(encoder.encode(withInjection));
						buffered = "";
						injected = true;
					}
				}
				if (buffered) {
					if (dev && !injected) {
						controller.enqueue(encoder.encode(buffered));
						controller.enqueue(HMR_TAG_BYTES);
					} else {
						controller.enqueue(encoder.encode(buffered));
					}
				} else if (dev && !injected) {
					controller.enqueue(HMR_TAG_BYTES);
				}
				controller.close();
			} catch (err) {
				controller.error(err);
			}
		},
	});
}
