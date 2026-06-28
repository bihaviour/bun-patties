/* Section manifest for the Specs / Design Specifications area.
   Declares the left-sidebar nav + prev/next order. Loaded before app.js.
   The specs are the design source of truth; the Release page tracks their status. */
window.SITE_BASE = "../";
window.SITE_SECTION = "specs";
window.SECTION = {
  brand: { title: "Design Specifications", sub: "The modular-monolith exploration" },
  groups: [
    { label: "Overview", items: [
      { file: "index.html",      title: "Overview & index" },
      { file: "guidelines.html", title: "Using Patties" },
    ]},
    { label: "Design", items: [
      { file: "architecture.html",      title: "Architecture" },
      { file: "features.html",          title: "Features" },
      { file: "ui-frontend-stack.html", title: "Frontend & UI stack" },
      { file: "decisions.html",         title: "Decision records" },
    ]},
    { label: "Architecture decisions", items: [
      { file: "adr-001.html", title: "ADR-001 — Folders, not classes" },
      { file: "adr-002.html", title: "ADR-002 — No DI container" },
      { file: "adr-003.html", title: "ADR-003 — Public-API boundary" },
      { file: "adr-004.html", title: "ADR-004 — Build-time discovery" },
      { file: "adr-005.html", title: "ADR-005 — Standards at the boundary" },
      { file: "adr-006.html", title: "ADR-006 — Libraries stay libraries" },
      { file: "adr-007.html", title: "ADR-007 — Data ownership" },
      { file: "adr-008.html", title: "ADR-008 — Bun-native only" },
      { file: "adr-009.html", title: "ADR-009 — Frontend & UI layer" },
    ]},
    { label: "Roadmap", items: [
      { file: "roadmap.html",                  title: "Delivery tracker" },
      { file: "epic-01.html",                  title: "Epic 01" },
      { file: "epic-02.html",                  title: "Epic 02" },
      { file: "epic-03.html",                  title: "Epic 03" },
      { file: "spec-21-create-patties.html",   title: "Spec 21 — create-patties" },
      { file: "spec-28-modular-monolith.html", title: "Spec 28 — Modular monolith" },
      { file: "spec-29-pluggable-validation.html", title: "Spec 29 — Pluggable validation" },
    ]},
  ],
};
