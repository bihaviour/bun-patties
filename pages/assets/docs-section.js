/* Section manifest for the Docs (user documentation) area.
   Declares the left-sidebar nav + prev/next order. Loaded before app.js. */
window.SITE_BASE = "../";
window.SITE_SECTION = "docs";
window.SECTION = {
  brand: { title: "Documentation", sub: "Build & ship with Patties" },
  groups: [
    { label: "Get started", items: [
      { file: "index.html",        title: "Introduction" },
      { file: "overview.html",     title: "Overview" },
      { file: "app-structure.html", title: "App structure" },
      { file: "scaffolding.html",  title: "Project scaffolding" },
    ]},
    { label: "Framework", items: [
      { file: "framework-overview.html", title: "Overview" },
      { file: "routing.html",            title: "Routing" },
      { file: "server.html",             title: "Server" },
      { file: "rendering-islands.html",  title: "Rendering & islands" },
      { file: "middleware-context.html", title: "Middleware & context" },
      { file: "configuration.html",      title: "Configuration & environment" },
      { file: "build-pipeline.html",     title: "Build pipeline" },
      { file: "adapters-targets.html",   title: "Adapters & targets" },
      { file: "plugins.html",            title: "Plugins" },
      { file: "ai-agents.html",          title: "AI & agents" },
      { file: "agents-md.html",          title: "AGENTS.md generation" },
    ]},
    { label: "CLI", items: [
      { file: "cli-overview.html", title: "Overview" },
      { file: "dev.html",          title: "dev" },
      { file: "build.html",        title: "build" },
      { file: "deploy.html",       title: "deploy" },
      { file: "secrets.html",      title: "secrets" },
    ]},
  ],
};
