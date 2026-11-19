#!/usr/bin/env node
// Builds a static preview of the Labspace, for GitHub Pages: the Labspace interface with the
// lab's instructions, but no server and no terminal. The Run and Save buttons show what they would
// do in a preview panel instead.
//
//   node labspace-local/static/build.mjs --base /sbx-lab/ --out _site
//
// It builds the interface client of dockersamples/labspace-infra, at a pinned commit, with three
// small patches (router base path, preview panel instead of the IDE), then writes the API answers
// the client expects as JSON files, and a fetch shim that maps the client's /api calls to them.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { toLabspace, uiConfig, withTheme } from "../content.mjs";

const LABSPACE_INFRA = "https://github.com/dockersamples/labspace-infra.git";
const LABSPACE_INFRA_COMMIT = "83f3c262cb68dfcf0d8b77066565fdb20d7ef2b1";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const instructionsDir = path.join(repoRoot, "instructions");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => (cur.startsWith("--") ? [...acc, [cur.slice(2), all[i + 1]]] : acc), []),
);
let base = args.base || "/";
if (!base.startsWith("/")) base = `/${base}`;
if (!base.endsWith("/")) base = `${base}/`;
const out = path.resolve(args.out || path.join(repoRoot, "_site"));
const work = args.work ? path.resolve(args.work) : fs.mkdtempSync(path.join(os.tmpdir(), "labspace-static-"));

const run = (cmd, cmdArgs, cwd) => execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit" });

function patch(file, from, to) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(from)) throw new Error(`Patch target not found in ${file}: ${from}`);
  fs.writeFileSync(file, text.replace(from, to));
}

// ------------------------------------------------------------------ build the client

const infra = path.join(work, "labspace-infra");
if (!fs.existsSync(path.join(infra, ".git"))) {
  fs.mkdirSync(infra, { recursive: true });
  run("git", ["init", "-q"], infra);
  run("git", ["remote", "add", "origin", LABSPACE_INFRA], infra);
}
run("git", ["fetch", "-q", "--depth", "1", "origin", LABSPACE_INFRA_COMMIT], infra);
run("git", ["checkout", "-q", "--force", "FETCH_HEAD"], infra);

const client = path.join(infra, "components", "interface", "client");
const src = path.join(client, "src");
// Served from a sub-path (https://<user>.github.io/<repo>/)
patch(
  path.join(src, "App.jsx"),
  "<BrowserRouter>",
  '<BrowserRouter basename={import.meta.env.BASE_URL.replace(/\\/$/, "")}>',
);
// The right panel shows the preview of the terminal instead of VS Code
patch(path.join(src, "TabContext.jsx"), 'url: "http://localhost:8085",', 'url: import.meta.env.BASE_URL + "terminal.html",');
patch(path.join(src, "TabContext.jsx"), 'title: "IDE",', 'title: "Terminal (preview)",');

run("npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"], client);
run("npx", ["vite", "build", "--base", base, "--outDir", out, "--emptyOutDir"], client);

// ------------------------------------------------------------------ static API

// labspace.yaml is parsed with the yaml package the interface itself uses
run("npm", ["install", "--no-save", "--no-audit", "--no-fund", "--loglevel=error", "yaml@2"], client);
const { parse } = createRequire(path.join(client, "package.json"))("yaml");

const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

const config = parse(fs.readFileSync(path.join(instructionsDir, "labspace.yaml"), "utf8"));
const sections = config.sections.map((section) => ({
  id: slug(section.title),
  title: section.title,
  content: toLabspace(fs.readFileSync(path.join(instructionsDir, section.contentPath), "utf8")),
}));
const services = (config.services || []).map((s) => ({ id: s.id || slug(s.title), title: s.title, icon: s.icon, url: s.url }));

const apiDir = path.join(out, "api");
fs.mkdirSync(path.join(apiDir, "sections"), { recursive: true });
const writeJson = (file, data) => fs.writeFileSync(path.join(apiDir, file), JSON.stringify(data));
writeJson("labspace.json", {
  title: config.title,
  subtitle: config.description,
  sections: sections.map(({ id, title }) => ({ id, title })),
  services,
});
writeJson("export.json", { title: config.title, subtitle: config.description, sections });
for (const section of sections) writeJson(`sections/${section.id}.json`, section);

// ------------------------------------------------------------------ shim, preview panel, deep links

fs.copyFileSync(path.join(here, "labspace-shim.js"), path.join(out, "labspace-shim.js"));
fs.copyFileSync(path.join(here, "terminal.html"), path.join(out, "terminal.html"));

const indexFile = path.join(out, "index.html");
const shimTag = `<script src="${base}labspace-shim.js" data-base="${base}"></script>`;
patch(indexFile, '<script type="module"', `${shimTag}\n    <script type="module"`);
// The look of the simulated lab (simspace/)
// with its header and milestones
fs.copyFileSync(path.join(here, "..", "theme.css"), path.join(out, "labspace-theme.css"));
fs.copyFileSync(path.join(here, "..", "labspace-ui.js"), path.join(out, "labspace-ui.js"));
// Docker's current logo, in place of the one in the interface image (the favicon, the header
// logo and the Dockerfile icon all use docker.svg)
fs.copyFileSync(path.join(here, "..", "docker.svg"), path.join(out, "docker.svg"));
fs.writeFileSync(
  path.join(out, "labspace-ui.json"),
  JSON.stringify(uiConfig(fs.readFileSync(path.join(instructionsDir, "labspace.yaml"), "utf8"), parse)),
);
fs.writeFileSync(indexFile, withTheme(fs.readFileSync(indexFile, "utf8"), base));
// Deep links to a section (<base><section>) load the app: a page per section, which works in a
// sub-folder of a site too, where GitHub Pages only uses the site's own 404.html; and 404.html for
// a site of its own.
for (const section of sections) {
  fs.mkdirSync(path.join(out, section.id), { recursive: true });
  fs.copyFileSync(indexFile, path.join(out, section.id, "index.html"));
}
fs.copyFileSync(indexFile, path.join(out, "404.html"));
fs.writeFileSync(path.join(out, ".nojekyll"), "");

console.log(`\nStatic Labspace written to ${out} (base ${base})`);
