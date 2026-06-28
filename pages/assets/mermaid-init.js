/* Polysheet spec site — shared client behavior */

/* ---- Mermaid (diagrams as SVG) ---- */
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

mermaid.initialize({
	startOnLoad: false, // we render lazily so hidden tab panels don't break
	theme: "base",
	securityLevel: "loose",
	fontFamily: "Inter, system-ui, sans-serif",
	themeVariables: {
		primaryColor: "#fff2e8",
		primaryBorderColor: "#f6c79b",
		primaryTextColor: "#241d15",
		lineColor: "#b8a78f",
		secondaryColor: "#f5efe7",
		tertiaryColor: "#faf7f3",
		fontSize: "14px",
	},
	flowchart: { curve: "basis", htmlLabels: true, useMaxWidth: true },
	er: { useMaxWidth: true },
	sequence: { useMaxWidth: true },
	gantt: { useMaxWidth: true },
});

/* Render only diagrams that are currently visible and not yet processed.
   Mermaid cannot measure nodes inside `display:none`, so hidden tab panels
   are rendered on demand the first time their tab is shown. */
async function renderVisible(root = document) {
	const nodes = [...root.querySelectorAll(".mermaid")].filter(
		(n) => !n.dataset.processed && n.offsetParent !== null,
	);
	if (nodes.length) {
		try {
			await mermaid.run({ nodes });
		} catch (e) {
			console.warn("mermaid render skipped:", e);
		}
	}
	// Wrap every freshly rendered diagram in a zoom/pan viewport.
	root.querySelectorAll(".mermaid[data-processed]").forEach((n) => {
		if (n.offsetParent !== null) enhanceDiagram(n);
	});
}

window.addEventListener("DOMContentLoaded", () => renderVisible());

/* ============================================================
   Zoom / pan viewport
   Gives every diagram an identical fixed-size frame, then lets the
   user pan (drag), zoom (toolbar / wheel / double-click), fit, and
   go fullscreen — so dense diagrams are no longer unreadable.
   ============================================================ */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function enhanceDiagram(el) {
	if (el.dataset.zoomReady) return;
	const svg = el.querySelector("svg");
	if (!svg) return;
	el.dataset.zoomReady = "1";

	// Intrinsic diagram size from the SVG viewBox (falls back to measured box).
	const vb = svg.viewBox?.baseVal;
	const natW = vb?.width ? vb.width : svg.getBoundingClientRect().width || 800;
	const natH = vb?.height
		? vb.height
		: svg.getBoundingClientRect().height || 400;
	svg.removeAttribute("style");
	svg.style.maxWidth = "none";
	svg.style.width = `${natW}px`;
	svg.style.height = `${natH}px`;

	// Flowcharts get draggable nodes; other diagram kinds (sequence, gantt, er)
	// don't have a node/edge graph to rearrange.
	const isFlowchart =
		!!svg.querySelector(".nodes g.node") && !!svg.querySelector(".edgePaths");

	// Build the viewport / stage / toolbar around the diagram.
	const viewport = document.createElement("div");
	viewport.className = "dzoom";
	const stage = document.createElement("div");
	stage.className = "dzoom__stage";
	const bar = document.createElement("div");
	bar.className = "dzoom__bar";
	bar.innerHTML =
		'<button data-act="out" title="Zoom out" aria-label="Zoom out">−</button>' +
		'<span class="dzoom__level">100%</span>' +
		'<button data-act="in" title="Zoom in" aria-label="Zoom in">+</button>' +
		'<button data-act="fit" title="Fit to frame" aria-label="Fit to frame">⤢</button>' +
		(isFlowchart
			? '<button data-act="reset" title="Reset arrangement" aria-label="Reset arrangement">↺</button>'
			: "") +
		'<button data-act="full" title="Fullscreen" aria-label="Fullscreen">⛶</button>';
	const hint = document.createElement("div");
	hint.className = "dzoom__hint";
	hint.textContent = isFlowchart
		? "drag a node to rearrange · drag canvas to pan · ⌘/Ctrl + scroll to zoom"
		: "drag to pan · ⌘/Ctrl + scroll to zoom · double-click to zoom";

	el.parentNode.insertBefore(viewport, el);
	stage.appendChild(el);
	viewport.appendChild(stage);
	viewport.appendChild(bar);
	viewport.appendChild(hint);

	const level = bar.querySelector(".dzoom__level");
	const MIN = 0.15,
		MAX = 8;
	let scale = 1,
		tx = 0,
		ty = 0,
		interacted = false;

	function apply() {
		stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
		level.textContent = `${Math.round(scale * 100)}%`;
	}
	function fit() {
		const vw = viewport.clientWidth,
			vh = viewport.clientHeight;
		if (!vw || !vh) return;
		// Fill the uniform frame: scale so the binding dimension spans the frame.
		// Small diagrams enlarge to fill (capped) instead of sitting tiny in the
		// corner; large ones shrink to fit, then can be zoomed from there.
		scale = clamp(Math.min(vw / natW, vh / natH), MIN, 3);
		tx = (vw - natW * scale) / 2;
		ty = (vh - natH * scale) / 2;
		apply();
	}
	function zoomAt(cx, cy, factor) {
		const ns = clamp(scale * factor, MIN, MAX);
		if (ns === scale) return;
		tx = cx - (cx - tx) * (ns / scale);
		ty = cy - (cy - ty) * (ns / scale);
		scale = ns;
		interacted = true;
		apply();
	}

	bar.addEventListener("click", (e) => {
		const btn = e.target.closest("button");
		if (!btn) return;
		const vw = viewport.clientWidth,
			vh = viewport.clientHeight;
		const act = btn.dataset.act;
		if (act === "in") zoomAt(vw / 2, vh / 2, 1.25);
		else if (act === "out") zoomAt(vw / 2, vh / 2, 1 / 1.25);
		else if (act === "fit") {
			interacted = false;
			fit();
		} else if (act === "reset") {
			resetLayout?.();
		} else if (act === "full") {
			if (document.fullscreenElement) document.exitFullscreen();
			else viewport.requestFullscreen?.();
		}
	});

	// Wheel zooms ONLY with a modifier held (⌘/Ctrl) or a trackpad pinch
	// (which arrives as a wheel event with ctrlKey=true). A plain wheel/scroll
	// is left alone so it scrolls the PAGE — diagrams never trap the scroll,
	// so the footer/rest of the page stays reachable.
	viewport.addEventListener(
		"wheel",
		(e) => {
			if (e.target.closest(".dzoom__bar")) return;
			if (!(e.ctrlKey || e.metaKey)) return; // plain scroll passes through to the page
			e.preventDefault();
			const r = viewport.getBoundingClientRect();
			zoomAt(
				e.clientX - r.left,
				e.clientY - r.top,
				e.deltaY < 0 ? 1.12 : 1 / 1.12,
			);
		},
		{ passive: false },
	);

	viewport.addEventListener("dblclick", (e) => {
		if (e.target.closest(".dzoom__bar")) return;
		const r = viewport.getBoundingClientRect();
		zoomAt(e.clientX - r.left, e.clientY - r.top, 1.6);
	});

	// Drag to pan.
	let dragging = false,
		lastX = 0,
		lastY = 0,
		pid = null;
	viewport.addEventListener("pointerdown", (e) => {
		if (e.target.closest(".dzoom__bar")) return;
		dragging = true;
		lastX = e.clientX;
		lastY = e.clientY;
		pid = e.pointerId;
		viewport.classList.add("is-grabbing");
		viewport.setPointerCapture(pid);
	});
	viewport.addEventListener("pointermove", (e) => {
		if (!dragging) return;
		tx += e.clientX - lastX;
		ty += e.clientY - lastY;
		lastX = e.clientX;
		lastY = e.clientY;
		interacted = true;
		apply();
	});
	const endDrag = () => {
		if (!dragging) return;
		dragging = false;
		viewport.classList.remove("is-grabbing");
		if (pid != null) {
			try {
				viewport.releasePointerCapture(pid);
			} catch {}
			pid = null;
		}
	};
	viewport.addEventListener("pointerup", endDrag);
	viewport.addEventListener("pointercancel", endDrag);

	viewport.addEventListener("fullscreenchange", () => fit());
	document.addEventListener("fullscreenchange", () => {
		if (!interacted) fit();
	});

	let rt;
	window.addEventListener("resize", () => {
		clearTimeout(rt);
		rt = setTimeout(() => {
			if (!interacted) fit();
		}, 150);
	});

	// ---- Draggable nodes (flowcharts only) ----
	// Let the reader rearrange the layout: drag a node and its edges follow,
	// redrawn as straight lines between the live node centers. `resetLayout`
	// (wired to the ↺ toolbar button) restores mermaid's original positions.
	let resetLayout = null;

	function setupNodeDrag() {
		const nodeEls = [...svg.querySelectorAll(".nodes g.node")];
		if (!nodeEls.length) return;

		const parseT = (g) => {
			const m = /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)/.exec(
				g.getAttribute("transform") || "",
			);
			return m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 };
		};

		const nodes = nodeEls.map((g) => {
			const t = parseT(g);
			let hw = 30;
			let hh = 20;
			try {
				const b = g.getBBox();
				hw = b.width / 2 || hw;
				hh = b.height / 2 || hh;
			} catch {}
			return {
				g,
				cx: t.x,
				cy: t.y,
				hw,
				hh,
				ox: t.x,
				oy: t.y,
				origT: g.getAttribute("transform"),
			};
		});

		// Map each node to its mermaid key (the user id baked into the element id
		// as `…flowchart-<KEY>-<index>`). Edge ids are `…L_<SRC>_<TGT>_<index>`,
		// so we can pair edges to nodes by key — far more reliable than guessing
		// from geometry when columns sit close together.
		const keyOf = (id) => {
			const m = /flowchart-(.+)-\d+$/.exec(id || "");
			return m ? m[1] : null;
		};
		const nodeByKey = new Map();
		for (const n of nodes) {
			const k = keyOf(n.g.id);
			if (k) nodeByKey.set(k, n);
		}
		// Split `<SRC>_<TGT>` against the known keys (either side may contain "_").
		const splitEdge = (id) => {
			const m = /L_(.+)_\d+$/.exec(id || "");
			if (!m) return null;
			const body = m[1];
			for (const k of nodeByKey.keys()) {
				if (body.startsWith(`${k}_`)) {
					const rest = body.slice(k.length + 1);
					if (nodeByKey.has(rest)) {
						return { src: nodeByKey.get(k), tgt: nodeByKey.get(rest) };
					}
				}
			}
			return null;
		};

		const edges = [];
		for (const p of svg.querySelectorAll(".edgePaths path")) {
			const ends = splitEdge(p.id);
			if (!ends) continue; // subgraph/cluster edges have no draggable node — skip
			const len = p.getTotalLength();
			edges.push({
				p,
				src: ends.src,
				tgt: ends.tgt,
				mid: p.getPointAtLength(len / 2),
				origD: p.getAttribute("d"),
				label: null,
				origLabelT: null,
			});
		}

		// Pair each edge label to the matched edge whose original midpoint sits
		// closest — but only when genuinely near, so a cluster-edge label (whose
		// edge we skipped) isn't snapped onto an unrelated edge.
		for (const lab of svg.querySelectorAll(".edgeLabels .edgeLabel")) {
			const t = parseT(lab);
			let best = null;
			let bd = 1600; // (~40px)² — beyond this, treat as "no match"
			for (const e of edges) {
				const d = (e.mid.x - t.x) ** 2 + (e.mid.y - t.y) ** 2;
				if (d < bd) {
					bd = d;
					best = e;
				}
			}
			if (best && !best.label) {
				best.label = lab;
				best.origLabelT = lab.getAttribute("transform");
			}
		}

		// Where the line from a node center toward (px,py) crosses the node's
		// bounding box — keeps arrowheads on the border, not buried in the shape.
		const exit = (cx, cy, hw, hh, px, py) => {
			const dx = px - cx;
			const dy = py - cy;
			if (!dx && !dy) return [cx, cy];
			let s;
			if (!dx) s = hh / Math.abs(dy);
			else if (!dy) s = hw / Math.abs(dx);
			else s = Math.min(hw / Math.abs(dx), hh / Math.abs(dy));
			return [cx + dx * s, cy + dy * s];
		};

		const redraw = (e) => {
			if (e.src === e.tgt) return; // leave self-loops as mermaid drew them
			const [ax, ay] = exit(
				e.src.cx,
				e.src.cy,
				e.src.hw,
				e.src.hh,
				e.tgt.cx,
				e.tgt.cy,
			);
			const [bx, by] = exit(
				e.tgt.cx,
				e.tgt.cy,
				e.tgt.hw,
				e.tgt.hh,
				e.src.cx,
				e.src.cy,
			);
			e.p.setAttribute("d", `M${ax},${ay}L${bx},${by}`);
			if (e.label) {
				e.label.setAttribute(
					"transform",
					`translate(${(ax + bx) / 2}, ${(ay + by) / 2})`,
				);
			}
		};

		for (const n of nodes) {
			n.g.addEventListener("pointerdown", (e) => {
				e.stopPropagation(); // don't let the viewport start a pan
				e.preventDefault();
				const sx = e.clientX;
				const sy = e.clientY;
				const cx0 = n.cx;
				const cy0 = n.cy;
				n.g.classList.add("is-dragging");
				n.g.setPointerCapture(e.pointerId);
				const move = (ev) => {
					n.cx = cx0 + (ev.clientX - sx) / scale;
					n.cy = cy0 + (ev.clientY - sy) / scale;
					n.g.setAttribute("transform", `translate(${n.cx}, ${n.cy})`);
					for (const e2 of edges) {
						if (e2.src === n || e2.tgt === n) redraw(e2);
					}
				};
				const up = () => {
					n.g.classList.remove("is-dragging");
					n.g.removeEventListener("pointermove", move);
					n.g.removeEventListener("pointerup", up);
					try {
						n.g.releasePointerCapture(e.pointerId);
					} catch {}
				};
				n.g.addEventListener("pointermove", move);
				n.g.addEventListener("pointerup", up);
			});
		}

		resetLayout = () => {
			for (const n of nodes) {
				n.cx = n.ox;
				n.cy = n.oy;
				if (n.origT) n.g.setAttribute("transform", n.origT);
			}
			for (const e of edges) {
				if (e.origD) e.p.setAttribute("d", e.origD);
				if (e.label && e.origLabelT) {
					e.label.setAttribute("transform", e.origLabelT);
				}
			}
		};
	}

	if (isFlowchart) setupNodeDrag();

	fit();
}

/* ============================================================
   Right-rail "on this page" navigation
   Builds a sticky table of contents from the page's <section id>
   headings, highlights the section in view, and only shows on wide
   screens (CSS gates it at >=1500px). Long pages get it for free.
   ============================================================ */
function buildPageNav() {
	// Idempotent: detail pages render content async then call this again.
	const old = document.querySelector(".pagenav");
	if (old) old.remove();
	const oldToggle = document.querySelector(".pagenav-toggle");
	if (oldToggle) oldToggle.remove();

	const main = document.querySelector("main.wrap");
	if (!main) return;
	const sections = [...main.querySelectorAll("section[id]")].filter((s) =>
		s.querySelector("h2.sec, h2, h3.sub"),
	);
	if (sections.length < 2) return; // only worthwhile when there's something to jump between

	const items = sections.map((s) => {
		const h = s.querySelector("h2.sec, h2, h3.sub");
		// strip the leading number chip text from "1 Title"
		let label = (h.textContent || "").trim();
		const numEl = h.querySelector(".num");
		if (numEl) label = label.replace(numEl.textContent.trim(), "").trim();
		return { id: s.id, label };
	});

	const nav = document.createElement("nav");
	nav.className = "pagenav";
	nav.id = "pagenav";
	nav.setAttribute("aria-label", "On this page");
	nav.innerHTML =
		'<div class="pagenav__title">On this page</div><ul>' +
		items.map((it) => `<li><a href="#${it.id}">${it.label}</a></li>`).join("") +
		"</ul>";

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.className = "pagenav-toggle";
	toggle.setAttribute("aria-controls", "pagenav");
	toggle.setAttribute("aria-expanded", "false");
	toggle.innerHTML =
		'<span class="pagenav-toggle__i" aria-hidden="true">☰</span> Contents';

	document.body.appendChild(nav);
	document.body.appendChild(toggle);
	requestAnimationFrame(() => nav.classList.add("is-ready"));

	// Open/close behavior (overlay mode on narrow screens; ignored on the wide rail)
	function setOpen(open) {
		nav.classList.toggle("is-open", open);
		toggle.setAttribute("aria-expanded", open ? "true" : "false");
	}
	toggle.addEventListener("click", (e) => {
		e.stopPropagation();
		setOpen(!nav.classList.contains("is-open"));
	});
	nav.addEventListener("click", (e) => {
		if (e.target.closest("a")) setOpen(false);
	});
	document.addEventListener("click", (e) => {
		if (!nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
	});
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape") setOpen(false);
	});

	const links = new Map(
		items.map((it) => [it.id, nav.querySelector(`a[href="#${it.id}"]`)]),
	);
	const setActive = (id) => {
		links.forEach((a, key) => {
			a.classList.toggle("is-active", key === id);
		});
	};

	// Scroll-spy: the last section whose top has passed the offset line wins.
	let ticking = false;
	const onScroll = () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			let current = sections[0].id;
			for (const s of sections) {
				if (s.getBoundingClientRect().top <= 120) current = s.id;
			}
			setActive(current);
			ticking = false;
		});
	};
	window.addEventListener("scroll", onScroll, { passive: true });
	onScroll();
}

window.buildPageNav = buildPageNav; // detail renderers call this after injecting content
window.addEventListener("DOMContentLoaded", buildPageNav);

/* ---- Tabs ---- */
window.showTab = (groupId, index, _btn) => {
	const group = document.getElementById(groupId);
	if (!group) return;
	group.querySelectorAll(":scope > .tabs > button").forEach((b, i) => {
		b.classList.toggle("active", i === index);
	});
	group.querySelectorAll(":scope > .tabpanel").forEach((p, i) => {
		p.classList.toggle("active", i === index);
	});
	// newly visible panel may hold an unrendered diagram
	renderVisible(group);
};

/* ---- Phase expand / collapse ---- */
document.addEventListener("click", (e) => {
	const head = e.target.closest(".phase__head");
	if (!head) return;
	head.closest(".phase").toggleAttribute("open");
});

window.expandAllPhases = (open) => {
	document.querySelectorAll(".phase").forEach((p) => {
		if (open) p.setAttribute("open", "");
		else p.removeAttribute("open");
	});
};

/* ---- Tracker epic expand / collapse (native <details>) ---- */
window.expandAllEpics = (open) => {
	document.querySelectorAll(".epic").forEach((p) => {
		if (open) p.setAttribute("open", "");
		else p.removeAttribute("open");
	});
};
