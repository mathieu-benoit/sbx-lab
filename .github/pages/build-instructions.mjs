// Builds the hands-on lab (README.md + instructions/) as a Simspace lab, for lab/ in the
// GitHub Pages site: the Simspace runtime renders it in the same instructions panel as the
// simulated lab, and instructions-only.css hides the terminal side.
//
//   node .github/pages/build-instructions.mjs <out-labs-dir>
//
// Nothing is copied into the repository: the sections are read from instructions/labspace.yaml
// and the Markdown is rewritten on the way out:
//   - links between modules (02-kits.md#x, ../README.md) become the runtime's #/<section> routes
//     (headings have no ids in the runtime, so the #anchor is dropped)
//   - links to other files of the repository (../project/...) point to GitHub
//   - the [[<< Previous | Next >>]] lines are dropped: the runtime has its own Previous/Next
//   - code blocks get no-run-button and lose terminal-id=: there's no terminal to run them in
//     (the Copy button stays, except on none blocks, which are outputs)
//   - the README's "What you will learn", "How a sandbox works" and "Table of contents" go to
//     overview.md, next to <out-labs-dir>, for the landing page at the root of the site: the
//     Welcome page links to it
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2];
if (!out) throw new Error("usage: build-instructions.mjs <out-labs-dir>");
const repo = process.env.GITHUB_REPOSITORY || "mathieu-benoit/sbx-lab";
const ref = process.env.GITHUB_REF_NAME || "main";
const LAB_ID = "sbx-lab";

// Section id, as the runtime derives it from the title (spec/labspace.md §5).
const slugify = (t) =>
  t.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");

// instructions/labspace.yaml: "- title: X" followed by "contentPath: Y" (the steps are dropped).
const yaml = readFileSync("instructions/labspace.yaml", "utf8");
const sections = [{ title: "Welcome", file: "README.md", src: "README.md" }];
for (const m of yaml.matchAll(/^\s*- title: (.+)\n\s+contentPath: (\S+)/gm)) {
  sections.push({ title: m[1].trim(), file: m[2], src: `instructions/${m[2]}` });
}
if (sections.length < 10) throw new Error(`only ${sections.length} sections found in instructions/labspace.yaml`);
const route = new Map(sections.map((s) => [s.src, `#/${slugify(s.title)}`]));

// Resolves a relative link from the file `from` to a repository path, then to its new target.
function rewrite(from, href) {
  if (/^([a-z]+:|#|mailto:)/i.test(href)) return href;
  const [path] = href.split("#");
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  const parts = [];
  for (const p of (base + path).split("/")) {
    if (p === "..") parts.pop();
    else if (p !== "." && p !== "") parts.push(p);
  }
  const target = parts.join("/");
  if (route.has(target)) return route.get(target);
  const kind = target === "" || path.endsWith("/") ? "tree" : "blob";
  return `https://github.com/${repo}/${kind}/${ref}/${target}`;
}

function convert(src) {
  let inFence = false;
  const lines = [];
  for (const line of readFileSync(src, "utf8").split("\n")) {
    const fence = line.match(/^([\s>]*)(```+|~~~+)(.*)$/); // also inside > quotes and alerts
    if (fence) {
      let info = fence[3].replace(/\s*terminal-id=\S+/g, "");
      if (!inFence && info.trim() && !info.trim().startsWith("mermaid")) info += " no-run-button";
      // A none block is a command's output, to read: nothing to copy either (as in labspace/)
      if (!inFence && info.trim().split(/\s+/)[0] === "none") info += " no-copy-button";
      inFence = !inFence;
      lines.push(fence[1] + fence[2] + info);
      continue;
    }
    if (inFence) { lines.push(line); continue; }
    // [[<< Previous: X](a.md) | [Next >> Y](b.md)], [[Home](../README.md)]
    if (/^\[\[.*\]\s*$/.test(line)) continue;
    lines.push(line.replace(/\]\(([^)\s]+)\)/g, (_, href) => `](${rewrite(src, href)})`));
  }
  return lines.join("\n");
}

// The README's overview sections are shared by both labs: they're shown on the landing page at the
// root of the site (written to overview.md, next to <out-dir>), and the Welcome page links to it
// instead. The landing page serves both labs, so the links into the hands-on lab go:
//   - How a sandbox works: the doors table loses its Module column (README.md keeps it)
//   - Table of contents: the module names lose their links, and the prerequisites, which only the
//     hands-on lab has, stay on its Welcome page, as does the "Stuck?" line
// Getting started stays in README.md only.
const OVERVIEW = ["What you will learn", "How a sandbox works", "Table of contents"];
const isRow = (line) => /^\|.*\|\s*$/.test(line);
const unlink = (line) => line.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
const forLanding = {
  "How a sandbox works": (lines) => lines.map((l) => (isRow(l) ? l.replace(/\|[^|]*\|\s*$/, "|") : l)),
  "Table of contents": (lines) =>
    lines.filter((l) => !/^Stuck\?/.test(l) && !/^\|\s*00\s*\|/.test(l)).map((l) => (isRow(l) ? unlink(l) : l)),
};
function splitOverview(markdown) {
  const welcome = [];
  const overview = [];
  let linked = false;
  for (const part of markdown.split(/^(?=## )/m)) {
    const title = OVERVIEW.find((t) => part.startsWith(`## ${t}\n`));
    if (!title) {
      // Getting started (clone the repository, do the prerequisites) is README.md's, for GitHub:
      // the Prerequisites module has the clone, and the Welcome page already points to it.
      if (!part.startsWith("## Getting started\n")) welcome.push(part);
      continue;
    }
    const lines = part.split("\n");
    overview.push((forLanding[title] || ((l) => l))(lines).join("\n"));
    if (!linked) {
      welcome.push("What you will learn, how a sandbox works, and the modules of the lab: see the [home page](../).\n\n");
      linked = true;
    }
    if (title === "Table of contents") {
      const prerequisites = lines.find((l) => /^\|\s*00\s*\|/.test(l));
      const stuck = lines.find((l) => /^Stuck\?/.test(l));
      if (!prerequisites || !stuck) throw new Error("README.md's table of contents changed: update build-instructions.mjs");
      const [, , module, what] = prerequisites.split("|").map((c) => c.trim());
      welcome.push(`The lab starts with module 00, ${module}, which you do **before the lab**: ${what.charAt(0).toLowerCase()}${what.slice(1)}.\n\n${stuck}\n\n`);
    }
  }
  if (overview.length !== OVERVIEW.length) throw new Error(`README.md must have the sections ${OVERVIEW.join(", ")}`);
  return [welcome.join(""), overview.join("").trimEnd() + "\n"];
}

const dir = join(out, LAB_ID);
mkdirSync(dir, { recursive: true });
for (const s of sections) {
  let md = convert(s.src);
  if (s.src === "README.md") {
    const [welcome, overview] = splitOverview(md);
    md = welcome;
    writeFileSync(join(out, "..", "overview.md"), overview);
  }
  writeFileSync(join(dir, s.file), md);
}

const q = (s) => JSON.stringify(s);
writeFileSync(
  join(dir, "labspace.yaml"),
  [
    `title: "Docker Sandboxes with GitHub Copilot"`,
    `description: "The hands-on lab: run the commands on your own machine."`,
    `simulator: simulator.yaml`,
    `tracking: false`,
    `sections:`,
    ...sections.map((s) => `  - title: ${q(s.title)}\n    contentPath: ${q(s.file)}`),
    "",
  ].join("\n"),
);
// No terminal to drive here: an empty scenario spec.
writeFileSync(join(dir, "simulator.yaml"), `version: "2.0"\nscenarios: []\n`);
console.log(`Wrote ${sections.length} sections to ${dir}`);
