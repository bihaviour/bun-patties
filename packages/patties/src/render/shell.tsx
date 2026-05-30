import type * as React from "react";

export interface ShellProps {
	headNodes: React.ReactNode[];
	children: React.ReactNode;
	clientScriptUrl?: string;
}

// The HMR client <script> tag is injected post-render as a raw string by
// render/index.tsx — it's a fixed framework snippet and is appended to the
// stream after React finishes. Keeping it out of the React tree avoids
// React's escape hatch APIs entirely.
export function Shell({ headNodes, children, clientScriptUrl }: ShellProps) {
	return (
		<html lang="en">
			<head>{headNodes}</head>
			<body>
				<div id="root">{children}</div>
				{clientScriptUrl ? (
					<script type="module" src={clientScriptUrl} />
				) : null}
			</body>
		</html>
	);
}
