import type * as React from "react";
import { BOOTSTRAP_ID } from "./bootstrap.ts";

export interface ShellProps {
	headNodes: React.ReactNode[];
	children: React.ReactNode;
	clientScriptUrl?: string;
	// Serialized `{ params, data }` for whole-tree hydrated pages. Rendered
	// outside `#root` so the client's `hydrateRoot` never sees it.
	bootstrap?: string;
}

// The HMR client <script> tag is injected post-render as a raw string by
// render/index.tsx — it's a fixed framework snippet and is appended to the
// stream after React finishes. Keeping it out of the React tree avoids
// React's escape hatch APIs entirely.
export function Shell({
	headNodes,
	children,
	clientScriptUrl,
	bootstrap,
}: ShellProps) {
	return (
		<html lang="en">
			<head>{headNodes}</head>
			<body>
				<div id="root">{children}</div>
				{bootstrap !== undefined ? (
					// React emits <script> text raw and rewrites `</script` to
					// `</script`, which stays valid JSON — no manual escaping needed.
					<script type="application/json" id={BOOTSTRAP_ID}>
						{bootstrap}
					</script>
				) : null}
				{clientScriptUrl ? (
					<script type="module" src={clientScriptUrl} />
				) : null}
			</body>
		</html>
	);
}
