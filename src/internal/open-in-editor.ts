// GET /__patties_open?file=<abs>&line=<n> → opens the file in the user's editor
// via Bun.openInEditor(), returns 204.
export async function handleOpenInEditor(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const file = url.searchParams.get("file");
	const lineRaw = url.searchParams.get("line");
	if (!file) return new Response("missing ?file", { status: 400 });
	const line = lineRaw ? Number(lineRaw) : undefined;

	try {
		const opener = (
			Bun as unknown as {
				openInEditor?: (f: string, opts?: { line?: number }) => void;
			}
		).openInEditor;
		if (typeof opener === "function") {
			opener(file, line ? { line } : undefined);
		}
		return new Response(null, { status: 204 });
	} catch (err) {
		return new Response((err as Error).message, { status: 500 });
	}
}
