// Renders overview.md into the landing page's [data-overview] sections. overview.md holds the
// README's "What you will learn" and "How a sandbox works", which both labs share: pages.yaml
// writes it with build-instructions.mjs, with the module links pointing into lab/. If it can't
// be read, the sections are left out and the page still shows the two labs.
(async () => {
  const slots = [...document.querySelectorAll("[data-overview]")];
  let markdown;
  try {
    const res = await fetch("overview.md");
    if (!res.ok) throw new Error(res.statusText);
    markdown = await res.text();
  } catch {
    slots.forEach((slot) => slot.remove());
    return;
  }

  const parts = new Map(
    markdown.split(/^(?=## )/m).map((part) => [part.slice(3, part.indexOf("\n")).trim(), part]),
  );
  for (const slot of slots) {
    const part = parts.get(slot.dataset.overview);
    if (!part) { slot.remove(); continue; }
    slot.innerHTML = DOMPurify.sanitize(marked.parse(part));
    for (const table of slot.querySelectorAll("table")) {
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      table.replaceWith(wrap);
      wrap.append(table);
    }
    for (const code of slot.querySelectorAll("pre > code.language-mermaid")) {
      const diagram = document.createElement("pre");
      diagram.className = "mermaid";
      diagram.textContent = code.textContent;
      code.parentElement.replaceWith(diagram);
    }
  }

  if (window.mermaid && document.querySelector(".overview pre.mermaid")) {
    // The diagram sets its own light colors, so it keeps a light background in dark mode too.
    mermaid.initialize({ startOnLoad: false, theme: "default" });
    await mermaid.run({ querySelector: ".overview pre.mermaid" });
  }
})();
