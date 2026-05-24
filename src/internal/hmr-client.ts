// Inline HMR client snippet, framework-controlled string (no user input).
// Injected into dev-mode HTML responses by src/render/index.tsx.
export const HMR_CLIENT_SCRIPT = `
(function () {
  var url = (location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + "/__patties_hmr";
  var backoff = 250;
  var failures = 0;
  function connect() {
    var ws;
    try { ws = new WebSocket(url); } catch (e) { schedule(); return; }
    ws.addEventListener("open", function () {
      backoff = 250;
      failures = 0;
    });
    ws.addEventListener("message", function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "reload") { location.reload(); return; }
      if (msg.type === "update" && msg.island) {
        try {
          window.dispatchEvent(new CustomEvent("patties:island-update", { detail: { island: msg.island } }));
        } catch (e) {}
      }
    });
    ws.addEventListener("close", function () { schedule(); });
    ws.addEventListener("error", function () { try { ws.close(); } catch (e) {} });
  }
  function schedule() {
    failures++;
    if (failures === 5) { try { console.warn("[patties] dev server unreachable, still retrying…"); } catch (e) {} }
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 5000);
  }
  connect();
})();
`.trim()
