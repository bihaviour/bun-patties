import type { ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server";

export async function renderStatic(node: ReactElement): Promise<string> {
	const stream = await renderToReadableStream(node);
	await stream.allReady;
	return await new Response(stream).text();
}
