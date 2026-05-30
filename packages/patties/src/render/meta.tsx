import type * as React from "react";

export interface MetaInput {
	title?: string;
	description?: string;
	[key: string]: string | undefined;
}

export function renderMetaTags(meta: MetaInput | undefined): React.ReactNode[] {
	if (!meta) return [];
	const nodes: React.ReactNode[] = [];
	let key = 0;
	if (meta.title) nodes.push(<title key={`meta-${key++}`}>{meta.title}</title>);
	for (const [name, value] of Object.entries(meta)) {
		if (name === "title" || value == null) continue;
		if (name === "description") {
			nodes.push(
				<meta key={`meta-${key++}`} name="description" content={value} />,
			);
			continue;
		}
		// OpenGraph and Twitter use property/name conventions; default to name.
		const attr =
			name.startsWith("og:") || name.startsWith("article:")
				? "property"
				: "name";
		nodes.push(
			attr === "property" ? (
				<meta key={`meta-${key++}`} property={name} content={value} />
			) : (
				<meta key={`meta-${key++}`} name={name} content={value} />
			),
		);
	}
	return nodes;
}

export function defaultHead(urlPath: string): React.ReactNode[] {
	return [
		<meta key="charset" charSet="utf-8" />,
		<meta
			key="viewport"
			name="viewport"
			content="width=device-width, initial-scale=1"
		/>,
		<title key="default-title">{urlPath || "/"}</title>,
	];
}
