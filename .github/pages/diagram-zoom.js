// Click-to-zoom for the Mermaid diagrams of the Pages site, like GitHub's diagram viewer: click a
// diagram (or focus it and press Enter) to open it in a popup, then zoom with the buttons, the
// mouse wheel or +/-, drag to pan, and close with Esc, the close button or a click outside.
// pages.yaml adds it to the Simspace runtime's index.html, in lab/ and simspace/; the Labspace
// (labspace-local/content.mjs) loads it too, at home and in labspace/.
(() => {
  const DIAGRAM = ".workshop-body svg[aria-roledescription]";
  const MIN = 0.5, MAX = 8, STEP = 1.25;

  const style = document.createElement("style");
  style.textContent = `
    ${DIAGRAM} { cursor: zoom-in; border-radius: 8px; }
    ${DIAGRAM}:hover, ${DIAGRAM}:focus-visible { outline: 2px solid #2560ff; outline-offset: 4px; }
    .dz-overlay { position: fixed; inset: 0; z-index: 10000; display: flex; padding: 24px;
      background: rgba(13, 18, 32, 0.6); }
    .dz-dialog { position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0;
      overflow: hidden; border-radius: 12px; background: #fff; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3); }
    .dz-toolbar { display: flex; gap: 4px; justify-content: flex-end; padding: 8px;
      border-bottom: 1px solid #e7ebf3; }
    .dz-toolbar button { display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; padding: 0; border: 0; border-radius: 8px; cursor: pointer;
      background: transparent; color: #1b2130; font: 22px/1 "Material Symbols Outlined"; }
    .dz-toolbar button:hover { background: rgba(37, 96, 255, 0.08); color: #2560ff; }
    .dz-toolbar button:focus-visible { outline: 2px solid #2560ff; }
    .dz-stage { flex: 1; overflow: hidden; cursor: grab; touch-action: none; }
    .dz-stage.is-dragging { cursor: grabbing; }
    .dz-canvas { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      padding: 24px; box-sizing: border-box; transform-origin: 0 0; }
    .dz-canvas svg { width: 100%; height: 100%; max-width: none !important; }
    [data-bs-theme="dark"] .dz-dialog { background: #161b26; }
    [data-bs-theme="dark"] .dz-toolbar { border-color: #2a3142; }
    [data-bs-theme="dark"] .dz-toolbar button { color: #e7ebf3; }
    @media (max-width: 600px) { .dz-overlay { padding: 8px; } }
  `;
  document.head.append(style);

  // Make every diagram reachable from the keyboard, as it is added to the page.
  const tag = () => {
    for (const svg of document.querySelectorAll(`${DIAGRAM}:not([data-dz])`)) {
      svg.dataset.dz = "";
      svg.setAttribute("tabindex", "0");
      svg.setAttribute("role", "button");
      svg.setAttribute("aria-label", "Open the diagram in a zoomable view");
    }
  };
  new MutationObserver(tag).observe(document.body, { childList: true, subtree: true });
  tag();

  document.addEventListener("click", (e) => {
    const svg = e.target.closest?.(DIAGRAM);
    if (svg && !e.target.closest(".dz-overlay")) open(svg);
  });
  document.addEventListener("keydown", (e) => {
    const svg = e.target.closest?.(DIAGRAM);
    if (svg && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(svg); }
  });

  function open(source) {
    const overlay = document.createElement("div");
    overlay.className = "dz-overlay";
    overlay.innerHTML = `
      <div class="dz-dialog" role="dialog" aria-modal="true" aria-label="Diagram">
        <div class="dz-toolbar">
          <button type="button" data-act="out" title="Zoom out (-)" aria-label="Zoom out">zoom_out</button>
          <button type="button" data-act="in" title="Zoom in (+)" aria-label="Zoom in">zoom_in</button>
          <button type="button" data-act="fit" title="Fit (0)" aria-label="Fit to the window">fit_screen</button>
          <button type="button" data-act="close" title="Close (Esc)" aria-label="Close">close</button>
        </div>
        <div class="dz-stage"><div class="dz-canvas"></div></div>
      </div>`;
    const stage = overlay.querySelector(".dz-stage");
    const canvas = overlay.querySelector(".dz-canvas");
    const clone = source.cloneNode(true);
    for (const a of ["tabindex", "role", "aria-label", "data-dz", "style", "width", "height"]) clone.removeAttribute(a);
    canvas.append(clone);

    // The diagram fits the stage at scale 1; zoom and pan move the canvas.
    let scale = 1, x = 0, y = 0;
    const apply = () => { canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; };
    const zoomAt = (factor, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2) => {
      const next = Math.min(MAX, Math.max(MIN, scale * factor));
      x = cx - ((cx - x) * next) / scale;
      y = cy - ((cy - y) * next) / scale;
      scale = next;
      apply();
    };
    const fit = () => { scale = 1; x = 0; y = 0; apply(); };

    const previous = document.activeElement;
    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") zoomAt(STEP);
      else if (e.key === "-") zoomAt(1 / STEP);
      else if (e.key === "0") fit();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("keydown", onKey, true);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) return close();
      const act = e.target.closest("button")?.dataset.act;
      if (act === "in") zoomAt(STEP);
      else if (act === "out") zoomAt(1 / STEP);
      else if (act === "fit") fit();
      else if (act === "close") close();
    });
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    let drag = null;
    stage.addEventListener("pointerdown", (e) => {
      drag = { px: e.clientX, py: e.clientY, x, y };
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("is-dragging");
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      x = drag.x + e.clientX - drag.px;
      y = drag.y + e.clientY - drag.py;
      apply();
    });
    const endDrag = () => { drag = null; stage.classList.remove("is-dragging"); };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    document.body.append(overlay);
    overlay.querySelector('[data-act="close"]').focus();
  }
})();
