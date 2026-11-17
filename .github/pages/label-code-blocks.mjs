// Shows where each command runs in the header of its code block, on the Simspace sites of the
// Pages site (the root and simspace/):
//
//   node .github/pages/label-code-blocks.mjs <labs-dir>...
//
// The Markdown marks each bash and none block id=host or id=sandbox. The Simspace runtime doesn't
// show that, but it shows a block's filename= in the header, in place of the language: this adds
// filename=<id> next to each id=, in the .md files under the given folders, rewritten in place (run
// it on the copies the workflow deploys, not on the sources). code-blocks.css then gives the header
// the right icon. A yaml block gets filename=yaml, for the runtime's file icon.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dirs = process.argv.slice(2);
if (!dirs.length) throw new Error("usage: label-code-blocks.mjs <labs-dir>...");

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : name.endsWith(".md") ? [path] : [];
  });

let labelled = 0;
for (const file of dirs.flatMap(files)) {
  const lines = readFileSync(file, "utf8").split("\n");
  let open = false;
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^([\s>]*)(```+)(.*)$/); // also inside > quotes and alerts
    if (!fence) continue;
    if (open) {
      if (fence[3].trim() === "") open = false;
      continue;
    }
    open = true;
    const meta = fence[3].trim().split(/\s+/);
    if (meta.some((m) => m.startsWith("filename=") || m.startsWith("save-as"))) continue;
    // A yaml block without an id is a file to read: filename=yaml keeps its "yaml" label and
    // gives it the runtime's file icon (code-blocks.css keeps that icon for yaml host blocks too)
    const id = meta.find((m) => m.startsWith("id="))?.slice(3) || (meta[0] === "yaml" ? "yaml" : null);
    if (!id) continue;
    lines[i] = `${fence[1]}${fence[2]}${[...meta, `filename=${id}`].join(" ")}`;
    labelled++;
  }
  writeFileSync(file, lines.join("\n"));
}
console.log(`Labelled ${labelled} code blocks under ${dirs.join(", ")}`);
