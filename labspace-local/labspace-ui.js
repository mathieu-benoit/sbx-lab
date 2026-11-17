// Adds to the Labspace interface the header and the milestones of the simulated lab (simspace/):
//   - a header: "Labspace", the lab's title, "<section> / <sections>" and a progress track;
//   - a "Milestones" card at the top of each section, from the `steps` of instructions/labspace.yaml.
// A milestone checks itself when you click Run or Copy on a code block, or open a link, whose text
// contains its `match`; clicking a milestone checks or unchecks it. Progress stays in this browser.
//
// The interface is a React app this script doesn't own: it only adds its own elements next to the
// interface's, and puts them back if a re-render removes them. Styles are in theme.css.
(() => {
  const base = document.currentScript?.dataset.base || "/";
  let config = null;
  let done = {};
  let storageKey = "labspace-ui";

  const load = () => {
    try {
      done = JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
    } catch {
      done = {};
    }
  };
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(done));
    } catch {
      /* private mode: progress only lasts for this page */
    }
  };

  // The section in the URL: /<section> (or /<repo>/<section> on GitHub Pages); the first one otherwise
  function activeIndex() {
    let rest = location.pathname.startsWith(base) ? location.pathname.slice(base.length) : location.pathname;
    rest = decodeURIComponent(rest.split("/").filter(Boolean)[0] || "");
    const index = config.sections.findIndex((s) => s.id === rest);
    return index >= 0 ? index : 0;
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function renderHeader(header, current) {
    header.replaceChildren();
    const bar = el("div", "lsui-header-bar");
    const brand = el("div", "lsui-brand");
    const logo = el("img", "lsui-brand-logo");
    logo.src = `${base}docker.svg`;
    logo.alt = "";
    const text = el("div", "lsui-brand-text");
    text.append(el("span", "lsui-brand-eyebrow", "Labspace"), el("span", "lsui-brand-title", config.title));
    brand.append(logo, text);

    const count = el("div", "lsui-progress-count");
    count.append(el("span", "lsui-progress-current", String(current + 1)), el("span", "lsui-progress-total", `/ ${config.sections.length}`));
    bar.append(brand, count);

    const track = el("div", "lsui-progress-track");
    config.sections.forEach((section, i) => {
      const segment = el("span", "lsui-progress-segment" + (i < current ? " is-complete" : "") + (i === current ? " is-active" : ""));
      segment.title = section.title;
      track.append(segment);
    });
    header.append(bar, track);
  }

  function renderMilestones(card, section) {
    card.replaceChildren();
    card.hidden = section.steps.length === 0;
    if (card.hidden) return;
    const doneHere = new Set(done[section.id] || []);
    card.append(el("span", "lsui-milestones-caption", "Milestones"));
    const list = el("ul", "lsui-milestones-list");
    for (const step of section.steps) {
      const isDone = doneHere.has(step.id);
      const item = el("li", "lsui-milestone" + (isDone ? " is-done" : ""));
      const button = el("button", "lsui-milestone-button");
      button.type = "button";
      button.title = isDone ? "Mark as not done" : "Mark as done";
      button.append(
        el("span", "lsui-milestone-check material-symbols-outlined", isDone ? "check_circle" : "radio_button_unchecked"),
        el("span", "lsui-milestone-title", step.title),
      );
      button.addEventListener("click", () => setDone(section, step, !isDone));
      item.append(button);
      list.append(item);
    }
    card.append(list);
  }

  function setDone(section, step, value) {
    const ids = new Set(done[section.id] || []);
    if (value) ids.add(step.id);
    else ids.delete(step.id);
    done[section.id] = [...ids];
    save();
    render();
  }

  // A header on each code block, as in the simulated lab: an icon and where the block runs
  // ("host" or "sandbox"), or its language. The interface numbers its blocks (data-code-index);
  // labspace-ui.json lists them in the same order. Added last and shown first (order: -1), so the
  // interface's own first child keeps its styles.
  // Material Symbols: a box for the sandbox, a file for a yaml file, a terminal otherwise; a
  // Dockerfile gets the Docker whale instead (theme.css draws it from docker.svg)
  const icon = (info) => (info.id === "sandbox" ? "deployed_code" : info.language === "yaml" ? "draft" : "terminal");
  const iconElement = (info) =>
    info.language === "dockerfile"
      ? el("span", "lsui-code-label-icon lsui-code-label-docker")
      : el("span", "lsui-code-label-icon material-symbols-outlined", icon(info));
  function renderCodeLabels(section) {
    for (const block of document.querySelectorAll(".workshop-body .code-block")) {
      const index = Number(block.querySelector("[data-code-index]")?.getAttribute("data-code-index"));
      const info = section.blocks?.[index];
      let label = block.querySelector(":scope > .lsui-code-label");
      block.dataset.lsuiLabelled = info?.label || ""; // handled: the observer leaves it alone
      if (!info) {
        label?.remove();
        continue;
      }
      if (label?.dataset.label === info.label) continue;
      label?.remove();
      label = el("div", "lsui-code-label");
      label.dataset.label = info.label;
      label.append(
        iconElement(info),
        el("span", "lsui-code-label-text", info.label),
      );
      block.append(label);
    }
  }

  // Puts the header and the card in place (again, after a re-render) and fills them
  function render() {
    if (!config) return;
    const body = document.querySelector(".workshop-body");
    const scroll = body?.parentElement;
    const column = scroll?.parentElement;
    if (!body || !column) return;

    let header = column.querySelector(":scope > .lsui-header");
    if (!header) {
      header = el("header", "lsui-header");
      column.insertBefore(header, scroll);
    }
    let card = scroll.querySelector(":scope > .lsui-milestones");
    if (!card) {
      card = el("div", "lsui-milestones");
      scroll.insertBefore(card, body);
    }
    const current = activeIndex();
    renderHeader(header, current);
    renderMilestones(card, config.sections[current]);
    renderCodeLabels(config.sections[current]);
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    // Not requestAnimationFrame: it doesn't run in a background tab, and the page would stay bare
    setTimeout(() => {
      scheduled = false;
      render();
    }, 0);
  };

  // Section changes go through the History API (react-router)
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      schedule();
      return result;
    };
  }
  window.addEventListener("popstate", schedule);

  // Run, Copy and links check the milestones they match
  document.addEventListener(
    "click",
    (event) => {
      if (!config) return;
      const target = event.target instanceof Element ? event.target : null;
      const block = target?.closest(".workshop-body .code-block");
      const link = target?.closest(".workshop-body a[href]");
      let text = null;
      if (block && target.closest("button")) text = block.querySelector("code")?.textContent || block.textContent;
      else if (link) text = link.getAttribute("href");
      if (!text) return;
      const section = config.sections[activeIndex()];
      for (const step of section.steps) {
        if (step.match && text.includes(step.match) && !(done[section.id] || []).includes(step.id)) setDone(section, step, true);
      }
    },
    true,
  );

  fetch(`${base}labspace-ui.json`, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.statusText))))
    .then((data) => {
      config = data;
      storageKey = `labspace-ui:${data.id}`;
      load();
      new MutationObserver(() => {
        const body = document.querySelector(".workshop-body");
        const missing =
          body &&
          (!body.parentElement.querySelector(":scope > .lsui-milestones") ||
            !body.parentElement.parentElement.querySelector(":scope > .lsui-header") ||
            body.querySelector('.code-block:not([data-lsui-labelled]), .code-block:not([data-lsui-labelled=""]):not(:has(> .lsui-code-label))'));
        if (missing) schedule();
      }).observe(document.body, { childList: true, subtree: true });
      render();
    })
    .catch((err) => console.warn("labspace-ui: no header nor milestones:", err.message));
})();
