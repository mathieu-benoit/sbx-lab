#!/usr/bin/env node
// The Labspace content: instructions/ as the Labspace interface should show it.
//
// - The modules end with a navigation footer for GitHub, such as
//     [[<< Previous: Kits](02-kits.md) | [Next >> Agent sandbox](04-first-sandbox.md)]
//   The Labspace has its own Previous/Next buttons, and these links would open the raw Markdown,
//   so the footer is removed.
// - Code blocks get Run and Copy buttons only when they are something to run or to type (commands,
//   and prompts for the agent): outputs and file listings get none.
// - labspace-ui.json carries what the header, the milestones and the code-block labels (host,
//   sandbox, or the language) need (labspace-ui.js).
//
//   node labspace-local/content.mjs <out-dir> [--watch]
//   node labspace-local/content.mjs --themed-index <out-file> < index.html

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const instructionsDir = path.resolve(here, "..", "instructions");

// A line made only of bracketed links: "[[Home](../README.md) | [Next >> X](01-x.md)]"
const FOOTER = /^\[\[[^\n]*\]\([^)\n]*\)\][ \t]*$/gm;

export function stripFooter(markdown) {
  return markdown.replace(FOOTER, "").replace(/\s+$/, "\n");
}

// A `console` block is either the output of a command, a table such as
//   HOST IP     HOST PORT   SANDBOX PORT   PROTOCOL
// or a prompt for the agent (sentences), which Run types into the agent session.
const TABLE_HEADER = /^[A-Z][A-Z0-9 _-]*[A-Z0-9](\s{2,}\S|$)/;

function blockOptions(language, firstLine) {
  switch (language) {
    case "bash":
    case "sh":
    case "shell":
      return []; // a command: Run and Copy
    case "console":
      return TABLE_HEADER.test(firstLine) ? ["no-run-button", "no-copy-button"] : [];
    case "mermaid":
      return []; // rendered as a diagram
    default:
      return ["no-copy-button"]; // none, text, yaml, dockerfile…: something to read
  }
}

// Adds the options to each code fence that needs them. The number and order of the blocks stay
// the same, so the Run buttons still point at the right block.
export function markCodeBlocks(markdown) {
  const lines = markdown.split("\n");
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^(\s*)```(.*)$/);
    if (!fence) continue;
    if (open) {
      if (fence[2].trim() === "") open = null;
      continue;
    }
    const [language = "", ...meta] = fence[2].trim().split(/\s+/);
    open = { language };
    const firstLine = (lines[i + 1] || "").trim();
    const add = blockOptions(language, firstLine).filter((option) => !meta.includes(option));
    if (add.length) lines[i] = `${fence[1]}\`\`\`${[language, ...meta, ...add].filter(Boolean).join(" ")}`;
  }
  return lines.join("\n");
}

export function toLabspace(markdown) {
  return markCodeBlocks(stripFooter(markdown));
}

const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

// The code blocks of a section, in the order the interface numbers them (its data-code-index):
// every fenced block, those inside > quotes and alerts included. For each, the label of its header:
// where it runs (id=host or id=sandbox) for bash and none blocks, its language otherwise, as the
// simulated lab shows them.
export function codeBlocks(markdown) {
  const blocks = [];
  let open = false;
  for (const line of markdown.split("\n")) {
    const fence = line.match(/^[\s>]*```(.*)$/);
    if (!fence) continue;
    if (open) {
      if (fence[1].trim() === "") open = false;
      continue;
    }
    open = true;
    const [language = "", ...meta] = fence[1].trim().split(/\s+/);
    const id = meta.find((m) => m.startsWith("id="))?.slice(3) || null;
    const shown = language === "sh" || language === "console" ? "bash" : language || "text";
    blocks.push({ label: id || shown, id, language: shown });
  }
  return blocks;
}

// What labspace-ui.js needs: the title, and the sections with their milestones and code blocks
export function uiConfig(labspaceYaml, parse, dir = instructionsDir) {
  const config = parse(labspaceYaml);
  return {
    id: config.metadata?.id || slug(config.title),
    title: config.title,
    sections: config.sections.map((section) => ({
      id: slug(section.title),
      title: section.title,
      steps: (section.steps || []).map((step) => ({ id: slug(step.title), title: step.title, match: step.match || null })),
      blocks: section.contentPath ? codeBlocks(fs.readFileSync(path.join(dir, section.contentPath), "utf8")) : [],
    })),
  };
}

// The interface's index.html with the theme (theme.css) and the header and milestones
// (labspace-ui.js) added after its own stylesheet and script
export function withTheme(html, base = "/") {
  if (html.includes("labspace-theme.css")) return html;
  if (!html.includes("</head>")) throw new Error("index.html has no </head>");
  const tags = [
    `<link rel="stylesheet" href="${base}labspace-theme.css">`,
    `<script src="${base}labspace-ui.js" data-base="${base}" defer></script>`,
  ];
  return html.replace("</head>", `  ${tags.join("\n    ")}\n  </head>`);
}

function yamlParser() {
  // Installed with the bridge's dependencies
  return createRequire(path.join(here, "bridge", "package.json"))("yaml").parse;
}

// The theme and the header/milestones script, served with the content: the content is a mounted
// folder, which follows edits, where a mounted single file keeps its first version.
export const UI_FILES = { "theme.css": "labspace-theme.css", "labspace-ui.js": "labspace-ui.js" };

export function writeContent(outDir, parse = yamlParser()) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const entry of fs.readdirSync(instructionsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const from = path.join(instructionsDir, entry.name);
    const to = path.join(outDir, entry.name);
    if (entry.name.endsWith(".md")) fs.writeFileSync(to, toLabspace(fs.readFileSync(from, "utf8")));
    else fs.copyFileSync(from, to);
  }
  const ui = uiConfig(fs.readFileSync(path.join(instructionsDir, "labspace.yaml"), "utf8"), parse);
  fs.writeFileSync(path.join(outDir, "labspace-ui.json"), JSON.stringify(ui));
  for (const [from, to] of Object.entries(UI_FILES)) fs.copyFileSync(path.join(here, from), path.join(outDir, to));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain && process.argv[2] === "--themed-index") {
  // node content.mjs --themed-index <out-file> < index.html
  const html = fs.readFileSync(0, "utf8");
  fs.mkdirSync(path.dirname(process.argv[3]), { recursive: true });
  fs.writeFileSync(process.argv[3], withTheme(html));
} else if (isMain) {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error("usage: node content.mjs <out-dir> [--watch]");
    process.exit(1);
  }
  writeContent(outDir);
  if (process.argv.includes("--watch")) {
    // Keep the copy current while the Labspace runs, so edits show on refresh.
    // Editors and git replace files (delete, then create): a copy can catch a file that is gone,
    // so a failed copy is retried on the next change instead of stopping the watcher.
    let timer;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          writeContent(outDir);
        } catch (err) {
          console.error(`content.mjs: ${err.message}; retrying on the next change`);
        }
      }, 150);
    };
    fs.watch(instructionsDir, update);
    fs.watch(here, (_, name) => name in UI_FILES && update());
  }
}
