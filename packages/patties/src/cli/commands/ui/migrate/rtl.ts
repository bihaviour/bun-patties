// Rewrite physical → logical properties. Scoped to className string literals,
// cn()/clsx() string arguments, and style-object keys (in .tsx/.ts), or CSS
// property names (in .css). Never rewrites bare identifiers; ambiguous dynamic
// class construction is reported, not guessed.

export interface RewriteResult {
	output: string;
	changed: boolean;
	reports: string[];
}

const EXACT: Record<string, string> = {
	"text-left": "text-start",
	"text-right": "text-end",
	"float-left": "float-start",
	"float-right": "float-end",
	"clear-left": "clear-start",
	"clear-right": "clear-end",
};

const PREFIX: Array<[string, string]> = [
	["ml-", "ms-"],
	["mr-", "me-"],
	["pl-", "ps-"],
	["pr-", "pe-"],
	["left-", "start-"],
	["right-", "end-"],
	["border-l-", "border-s-"],
	["border-r-", "border-e-"],
	["rounded-tl-", "rounded-ss-"],
	["rounded-tr-", "rounded-se-"],
	["rounded-bl-", "rounded-es-"],
	["rounded-br-", "rounded-ee-"],
	["rounded-l-", "rounded-s-"],
	["rounded-r-", "rounded-e-"],
];

const BARE: Record<string, string> = {
	"border-l": "border-s",
	"border-r": "border-e",
	"rounded-l": "rounded-s",
	"rounded-r": "rounded-e",
	"rounded-tl": "rounded-ss",
	"rounded-tr": "rounded-se",
	"rounded-bl": "rounded-es",
	"rounded-br": "rounded-ee",
};

const STYLE_KEYS: Record<string, string> = {
	marginLeft: "marginInlineStart",
	marginRight: "marginInlineEnd",
	paddingLeft: "paddingInlineStart",
	paddingRight: "paddingInlineEnd",
	borderLeft: "borderInlineStart",
	borderRight: "borderInlineEnd",
};

const CSS_PROPS: Array<[RegExp, string]> = [
	[/margin-left/g, "margin-inline-start"],
	[/margin-right/g, "margin-inline-end"],
	[/padding-left/g, "padding-inline-start"],
	[/padding-right/g, "padding-inline-end"],
	[/border-left/g, "border-inline-start"],
	[/border-right/g, "border-inline-end"],
];

function mapCore(core: string): string {
	const exact = EXACT[core];
	if (exact) return exact;
	for (const [from, to] of PREFIX) {
		if (core.startsWith(from)) return to + core.slice(from.length);
	}
	const bare = BARE[core];
	if (bare) return bare;
	return core;
}

// Map a single Tailwind class token, preserving variant prefixes (`md:`,
// `hover:`) and a leading negative sign.
function mapToken(token: string): string {
	if (token === "") return token;
	const colon = token.lastIndexOf(":");
	const variant = colon >= 0 ? token.slice(0, colon + 1) : "";
	let core = colon >= 0 ? token.slice(colon + 1) : token;
	const neg = core.startsWith("-") ? "-" : "";
	if (neg) core = core.slice(1);
	return variant + neg + mapCore(core);
}

function mapClassString(s: string): string {
	return s
		.split(/(\s+)/)
		.map((part) => (/^\s+$/.test(part) ? part : mapToken(part)))
		.join("");
}

const CLASSNAME_DQ = /className=(")([^"]*)"/g;
const CLASSNAME_SQ = /className=(')([^']*)'/g;
const CLASSNAME_TPL = /className=\{`([^`]*)`\}/g;
const CN_CALL = /\b(cn|clsx)\(([^)]*)\)/g;
const STRING_LIT = /(["'])((?:(?!\1).)*)\1/g;

export function rewriteRtl(source: string, isCss: boolean): RewriteResult {
	if (isCss) {
		let out = source;
		for (const [re, to] of CSS_PROPS) out = out.replace(re, to);
		return { output: out, changed: out !== source, reports: [] };
	}

	const reports: string[] = [];
	let out = source;

	out = out.replace(
		CLASSNAME_DQ,
		(_m, _q, body: string) => `className="${mapClassString(body)}"`,
	);
	out = out.replace(
		CLASSNAME_SQ,
		(_m, _q, body: string) => `className='${mapClassString(body)}'`,
	);
	out = out.replace(CLASSNAME_TPL, (m, body: string) => {
		if (body.includes("${")) {
			reports.push(`dynamic className template — review manually: ${m.trim()}`);
			return m;
		}
		return `className={\`${mapClassString(body)}\`}`;
	});

	// cn()/clsx() string-literal arguments.
	out = out.replace(CN_CALL, (_m, fn: string, args: string) => {
		const mapped = args.replace(
			STRING_LIT,
			(_s, q: string, body: string) => `${q}${mapClassString(body)}${q}`,
		);
		return `${fn}(${mapped})`;
	});

	// style={{ ... }} object keys.
	out = out.replace(/style=\{\{([^}]*)\}\}/g, (_m, body: string) => {
		let inner = body;
		for (const [k, v] of Object.entries(STYLE_KEYS)) {
			inner = inner.replace(new RegExp(`\\b${k}\\b`, "g"), v);
		}
		return `style={{${inner}}}`;
	});

	return { output: out, changed: out !== source, reports };
}
