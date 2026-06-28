#!/usr/bin/env bun
/**
 * Render the design specifications (`agent_specs/`) into browsable HTML under
 * `pages/release/specs/`, matching the site chrome (header, sidebar, theme,
 * TOC, prev/next — all driven by `pages/assets/app.js`). Re-runnable: it wipes
 * and regenerates the output directory plus the section manifest on every run.
 *
 * Zero dependencies — a small Markdown→HTML renderer (no marked/remark), in the
 * Bun-native spirit of `scripts/serve-pages.ts`.
 *
 *   bun run scripts/build-specs.ts
 *
 * The specs are flattened into one directory (the site's section nav uses bare
 * filenames as hrefs), so `rfcs/accepted/rfc-bun-cron.md` becomes
 * `rfcs-accepted-rfc-bun-cron.html`. Cross-document `.md` links are rewritten to
 * the flattened name; links that don't resolve degrade to plain text.
 */
import { rm } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = `${ROOT}agent_specs`;
const OUT = `${ROOT}pages/release/specs`;
const MANIFEST = `${ROOT}pages/assets/specs-src-section.js`;

// Order categories are listed in the sidebar + index. Anything unlisted falls
// to the end, alphabetically.
const TOP_ORDER = ["framework", "cli", "ui", "rfcs", "research"];
const SUB_ORDER = [
	"draft",
	"progress",
	"accepted",
	"backlog",
	"deferred",
	"out-of-scope",
	"archive",
];

interface Status {
	label: string;
	cls: string;
}

interface Doc {
	rel: string; // source path relative to agent_specs, e.g. "rfcs/accepted/x.md"
	out: string; // flattened output filename, e.g. "rfcs-accepted-x.html"
	title: string;
	status: Status;
	group: string; // sidebar group label, e.g. "RFCs · accepted"
	groupKey: string; // sort key for the group
	summary: string;
	isTxt: boolean;
}

// ---- helpers ---------------------------------------------------------------

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
	return escapeHtml(s).replace(/"/g, "&quot;");
}

function flatten(rel: string): string {
	return rel.replace(/\.[^.]+$/, "").replace(/\//g, "-");
}

function dirOf(rel: string): string {
	const idx = rel.lastIndexOf("/");
	return idx === -1 ? "" : rel.slice(0, idx);
}

function normalizePosix(p: string): string {
	const out: string[] = [];
	for (const part of p.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			out.pop();
			continue;
		}
		out.push(part);
	}
	return out.join("/");
}

function humanize(rel: string): string {
	const base = rel.split("/").pop() ?? rel;
	const stem = base.replace(/\.[^.]+$/, "").replace(/^\d+[-_]/, "");
	const words = stem.replace(/[-_]/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function statusFor(rel: string, fm: Map<string, string>): Status {
	const fromFm = (fm.get("verdict") ?? fm.get("status") ?? "").toLowerCase();
	const segs = rel.split("/");
	const hay = `${segs.join(" ")} ${fromFm}`;
	if (/\baccept|accepted\b/.test(hay))
		return { label: "Accepted", cls: "status-approved" };
	if (segs.includes("archive") || fromFm === "encoded")
		return { label: "Archived", cls: "status-approved" };
	if (segs.includes("progress"))
		return { label: "In progress", cls: "status-review" };
	if (segs.includes("backlog"))
		return { label: "Backlog", cls: "status-review" };
	if (segs.includes("deferred"))
		return { label: "Deferred", cls: "status-review" };
	if (segs.includes("out-of-scope"))
		return { label: "Out of scope", cls: "status-review" };
	if (segs[0] === "research")
		return { label: "Research", cls: "status-review" };
	if (segs.includes("draft")) return { label: "Draft", cls: "status-draft" };
	return { label: "Spec", cls: "status-draft" };
}

function groupFor(rel: string): { label: string; key: string } {
	const segs = rel.split("/");
	const top = segs[0] ?? "";
	const sub =
		(segs.length > 2 ? segs[1] : top === "research" ? "" : segs[1]) ?? "";
	const topRank = TOP_ORDER.indexOf(top);
	const subRank = SUB_ORDER.indexOf(sub);
	const labelTop =
		top === "cli" || top === "ui" || top === "rfcs"
			? top.toUpperCase()
			: top.charAt(0).toUpperCase() + top.slice(1);
	const label = sub ? `${labelTop} · ${sub}` : labelTop;
	const key = `${topRank < 0 ? 99 : topRank}:${top}:${subRank < 0 ? 99 : subRank}:${sub}`;
	return { label, key };
}

// ---- frontmatter -----------------------------------------------------------

function parseFrontmatter(text: string): {
	fm: Map<string, string>;
	body: string;
} {
	const fm = new Map<string, string>();
	if (!text.startsWith("---\n")) return { fm, body: text };
	const end = text.indexOf("\n---", 4);
	if (end === -1) return { fm, body: text };
	const block = text.slice(4, end);
	for (const line of block.split("\n")) {
		const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
		if (m?.[1]) fm.set(m[1], (m[2] ?? "").replace(/^["']|["']$/g, "").trim());
	}
	const rest = text.slice(end + 4).replace(/^\n+/, "");
	return { fm, body: rest };
}

// ---- Markdown → HTML -------------------------------------------------------

type LinkResolver = (
	href: string,
) => { href: string; external: boolean } | null;

function renderInline(text: string, resolve: LinkResolver): string {
	const codes: string[] = [];
	let s = text.replace(/`([^`]+)`/g, (_m, c: string) => {
		codes.push(c);
		return `@@CODE${codes.length - 1}END@@`;
	});
	s = escapeHtml(s);
	s = s.replace(
		/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
		(_m, alt: string, src: string) => {
			const r = resolve(src);
			return r
				? `<img src="${escapeAttr(r.href)}" alt="${escapeAttr(alt)}">`
				: escapeHtml(alt);
		},
	);
	s = s.replace(
		/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
		(_m, label: string, href: string) => {
			const r = resolve(href);
			if (!r) return label;
			const attrs = r.external ? ' target="_blank" rel="noopener"' : "";
			return `<a href="${escapeAttr(r.href)}"${attrs}>${label}</a>`;
		},
	);
	s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	s = s.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, "$1<em>$2</em>");
	s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
	s = s.replace(
		/@@CODE(\d+)END@@/g,
		(_m, i: string) => `<code>${escapeHtml(codes[Number(i)] ?? "")}</code>`,
	);
	return s;
}

function indentOf(line: string): number {
	const m = /^(\s*)/.exec(line);
	return m?.[1] ? m[1].replace(/\t/g, "  ").length : 0;
}

function isListItem(line: string): boolean {
	return /^\s*([-*+]|\d+\.)\s+/.test(line);
}

function buildList(block: string[], resolve: LinkResolver): string {
	const first = block.find((l) => l.trim()) ?? "";
	const ordered = /^\s*\d+\./.test(first);
	let out = ordered ? "<ol>" : "<ul>";
	let i = 0;
	while (i < block.length) {
		const m = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(block[i] ?? "");
		if (!m) {
			i++;
			continue;
		}
		const itemIndent = (m[1] ?? "").replace(/\t/g, "  ").length;
		const text = m[3] ?? "";
		const children: string[] = [];
		i++;
		while (i < block.length) {
			const n = block[i] ?? "";
			if (!n.trim()) {
				children.push("");
				i++;
				continue;
			}
			if (indentOf(n) > itemIndent) {
				children.push(n);
				i++;
				continue;
			}
			break;
		}
		const nested = children.filter((c) => isListItem(c));
		const cont = children
			.filter((c) => c.trim() && !isListItem(c))
			.map((c) => c.trim());
		let inner = renderInline([text, ...cont].join(" ").trim(), resolve);
		if (nested.length) inner += buildList(nested, resolve);
		out += `<li>${inner}</li>`;
	}
	return out + (ordered ? "</ol>" : "</ul>");
}

function splitRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((c) => c.trim());
}

function renderMarkdown(body: string, resolve: LinkResolver): string {
	const lines = body.split("\n");
	let html = "";
	let i = 0;
	while (i < lines.length) {
		const line = lines[i] ?? "";
		const fence = /^```(.*)$/.exec(line);
		if (fence) {
			const lang = (fence[1] ?? "").trim();
			const buf: string[] = [];
			i++;
			while (i < lines.length && !/^```/.test(lines[i] ?? "")) {
				buf.push(lines[i] ?? "");
				i++;
			}
			i++;
			const attr = lang ? ` data-lang="${escapeAttr(lang)}"` : "";
			html += `<pre${attr}><code>${escapeHtml(buf.join("\n"))}\n</code></pre>\n`;
			continue;
		}
		if (!line.trim()) {
			i++;
			continue;
		}
		const h = /^(#{1,6})\s+(.*)$/.exec(line);
		if (h) {
			const lvl = (h[1] ?? "").length;
			html += `<h${lvl}>${renderInline((h[2] ?? "").replace(/\s+#+\s*$/, "").trim(), resolve)}</h${lvl}>\n`;
			i++;
			continue;
		}
		if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
			html += "<hr>\n";
			i++;
			continue;
		}
		if (/^\s*>/.test(line)) {
			const buf: string[] = [];
			while (i < lines.length && /^\s*>/.test(lines[i] ?? "")) {
				buf.push((lines[i] ?? "").replace(/^\s*>\s?/, ""));
				i++;
			}
			html += `<blockquote>${renderMarkdown(buf.join("\n"), resolve)}</blockquote>\n`;
			continue;
		}
		const next = lines[i + 1] ?? "";
		if (
			line.includes("|") &&
			/-/.test(next) &&
			/^\s*\|?[\s:|-]+$/.test(next) &&
			next.includes("|")
		) {
			const header = splitRow(line);
			i += 2;
			const rows: string[][] = [];
			while (
				i < lines.length &&
				(lines[i] ?? "").includes("|") &&
				(lines[i] ?? "").trim()
			) {
				rows.push(splitRow(lines[i] ?? ""));
				i++;
			}
			const head = header
				.map((c) => `<th>${renderInline(c, resolve)}</th>`)
				.join("");
			const body2 = rows
				.map(
					(r) =>
						`<tr>${r.map((c) => `<td>${renderInline(c, resolve)}</td>`).join("")}</tr>`,
				)
				.join("");
			html += `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body2}</tbody></table></div>\n`;
			continue;
		}
		if (isListItem(line)) {
			const base = indentOf(line);
			const block: string[] = [];
			while (i < lines.length) {
				const l = lines[i] ?? "";
				if (!l.trim()) {
					let j = i + 1;
					while (j < lines.length && !(lines[j] ?? "").trim()) j++;
					const peek = lines[j] ?? "";
					if (j < lines.length && (isListItem(peek) || indentOf(peek) > base)) {
						i = j;
						continue;
					}
					break;
				}
				if (indentOf(l) < base && !isListItem(l)) break;
				if (indentOf(l) <= base && !isListItem(l)) break;
				block.push(l);
				i++;
			}
			html += `${buildList(block, resolve)}\n`;
			continue;
		}
		const buf = [line];
		i++;
		while (i < lines.length) {
			const l = lines[i] ?? "";
			if (
				!l.trim() ||
				/^(#{1,6}\s|```|\s*>)/.test(l) ||
				isListItem(l) ||
				/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)
			)
				break;
			buf.push(l);
			i++;
		}
		html += `<p>${renderInline(buf.join(" ").trim(), resolve)}</p>\n`;
	}
	return html;
}

// ---- page template ---------------------------------------------------------

function page(title: string, metaDesc: string, articleInner: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Patties specs</title>
<meta name="description" content="${escapeAttr(metaDesc)}">
<link rel="stylesheet" href="../../assets/app.css">
<script>try{var t=localStorage.getItem('bd-theme')||((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<button class="nav-toggle" aria-label="Toggle navigation">☰</button>
<div class="layout">
<aside class="sidebar" id="sidebar"></aside>
<main class="content" id="main">
<article>
${articleInner}
</article>
</main>
</div>
<script src="../../assets/specs-src-section.js"></script>
<script src="../../assets/app.js"></script>
</body>
</html>
`;
}

function summarize(body: string): string {
	for (const raw of body.split("\n")) {
		const l = raw.trim();
		if (
			!l ||
			l.startsWith("#") ||
			l.startsWith(">") ||
			l.startsWith("```") ||
			l.startsWith("|") ||
			isListItem(l)
		)
			continue;
		const plain = l
			.replace(/`([^`]+)`/g, "$1")
			.replace(/\*\*([^*]+)\*\*/g, "$1")
			.replace(/[*_]/g, "")
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
		return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain;
	}
	return "";
}

// ---- main ------------------------------------------------------------------

async function main(): Promise<void> {
	await rm(OUT, { recursive: true, force: true });

	const glob = new Bun.Glob("**/*.{md,txt}");
	const rels: string[] = [];
	for await (const rel of glob.scan({ cwd: SRC, onlyFiles: true }))
		rels.push(rel.replace(/\\/g, "/"));
	rels.sort();

	// First pass: build the path → output-file map for link resolution.
	const docs: Doc[] = [];
	const byRel = new Map<string, Doc>();
	for (const rel of rels) {
		const isTxt = rel.endsWith(".txt");
		const out = `${flatten(rel)}.${isTxt ? "txt" : "html"}`;
		const doc: Doc = {
			rel,
			out,
			title: "",
			status: { label: "", cls: "" },
			group: "",
			groupKey: "",
			summary: "",
			isTxt,
		};
		docs.push(doc);
		byRel.set(rel, doc);
	}
	if (new Set(docs.map((d) => d.out)).size !== docs.length) {
		throw new Error("Flattened filename collision — adjust flatten().");
	}

	// Second pass: render each document.
	for (const doc of docs) {
		const grp = groupFor(doc.rel);
		doc.group = grp.label;
		doc.groupKey = grp.key;
		const resolve: LinkResolver = (href) => {
			if (/^(https?:|mailto:|data:)/.test(href))
				return { href, external: true };
			if (href.startsWith("#")) return { href, external: false };
			const [path, anchor] = href.split("#");
			if (!path) return { href, external: false };
			const target = resolveTarget(doc.rel, path);
			const found = byRel.get(target);
			if (!found) return null;
			return {
				href: found.out + (anchor ? `#${anchor}` : ""),
				external: false,
			};
		};

		if (doc.isTxt) {
			doc.title = humanize(doc.rel);
			doc.status = statusFor(doc.rel, new Map());
			doc.summary = "Raw research capture (plain text).";
			await Bun.write(`${OUT}/${doc.out}`, Bun.file(`${SRC}/${doc.rel}`));
			continue;
		}

		const text = await Bun.file(`${SRC}/${doc.rel}`).text();
		const { fm, body: afterFm } = parseFrontmatter(text);
		const h1 = /^#\s+(.+)$/m.exec(afterFm);
		const fmTitle = fm.get("title");
		doc.title = fmTitle || (h1?.[1] ?? "").trim() || humanize(doc.rel);
		doc.status = statusFor(doc.rel, fm);
		// Drop the first H1 from the body — the page header carries the title.
		const body = h1 ? afterFm.replace(h1[0], "").replace(/^\n+/, "") : afterFm;
		doc.summary = summarize(body);

		const header =
			`<header class="page-header">\n` +
			`<div class="spec-meta"><span class="badge badge-status ${doc.status.cls}">${escapeHtml(doc.status.label)}</span> <span class="badge badge-id">${escapeHtml(doc.rel)}</span></div>\n` +
			`<h1>${escapeHtml(doc.title)}</h1>\n` +
			(doc.summary ? `<p class="lede">${escapeHtml(doc.summary)}</p>\n` : "") +
			`</header>`;
		const article = `${header}\n${renderMarkdown(body, resolve)}\n<nav class="doc-footer" id="page-nav"></nav>`;
		await Bun.write(
			`${OUT}/${doc.out}`,
			page(doc.title, doc.summary || doc.title, article),
		);
	}

	// Group the docs in display order.
	const groups = new Map<string, Doc[]>();
	for (const d of docs) {
		const arr = groups.get(d.groupKey) ?? [];
		arr.push(d);
		groups.set(d.groupKey, arr);
	}
	const orderedKeys = [...groups.keys()].sort();

	// Section manifest consumed by app.js (sidebar + prev/next).
	const manifestGroups = orderedKeys.map((k) => {
		const arr = groups.get(k) ?? [];
		const label = arr[0]?.group ?? k;
		const items = arr
			.map(
				(d) =>
					`\t\t\t{ file: ${JSON.stringify(d.out)}, title: ${JSON.stringify(d.title)} },`,
			)
			.join("\n");
		return `\t\t{ label: ${JSON.stringify(label)}, items: [\n${items}\n\t\t]},`;
	});
	const manifest = `/* Section manifest for the design specifications browser.
   GENERATED by scripts/build-specs.ts — do not edit by hand; re-run the script.
   Declares the left-sidebar nav + prev/next order for pages/release/specs/. */
window.SITE_BASE = "../../";
window.SITE_SECTION = "release";
window.SECTION = {
	brand: { title: "Design Specifications", sub: "agent_specs — full archive" },
	groups: [
${manifestGroups.join("\n")}
	],
};
`;
	await Bun.write(MANIFEST, manifest);

	// Index page.
	const cards = orderedKeys
		.map((k) => {
			const arr = groups.get(k) ?? [];
			const label = arr[0]?.group ?? k;
			const links = arr
				.map(
					(d) =>
						`<a href="${escapeAttr(d.out)}"><span class="xref-title">${escapeHtml(d.title)}</span><span class="xref-desc">${escapeHtml(d.summary || d.rel)}</span></a>`,
				)
				.join("\n");
			return `<section>\n<h2>${escapeHtml(label)} <span class="badge badge-id">${arr.length}</span></h2>\n<div class="xref-grid">\n${links}\n</div>\n</section>`;
		})
		.join("\n");
	const indexArticle =
		`<header class="page-header">\n<h1>Design specifications</h1>\n` +
		`<p class="lede">The complete <code>agent_specs/</code> archive — ${docs.length} documents across framework, CLI, UI, RFCs, and research. These are the design source of truth behind Patties; the <a href="../index.html">Release page</a> tracks the status of the live ones.</p>\n</header>\n${cards}\n<nav class="doc-footer" id="page-nav"></nav>`;
	await Bun.write(
		`${OUT}/index.html`,
		page(
			"Design specifications",
			"The complete agent_specs archive behind Patties.",
			indexArticle,
		),
	);

	console.log(
		`build-specs → ${docs.length} documents (${docs.filter((d) => d.isTxt).length} raw) into pages/release/specs/`,
	);
	console.log(
		`           → ${orderedKeys.length} sidebar groups, manifest at pages/assets/specs-src-section.js`,
	);
}

function resolveTarget(fromRel: string, href: string): string {
	const base = dirOf(fromRel);
	return normalizePosix(base ? `${base}/${href}` : href);
}

await main();
