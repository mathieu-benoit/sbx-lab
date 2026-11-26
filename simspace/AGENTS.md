# AGENTS.md

Orientation for agents working in **`simspace/`**, the in-browser, simulated version of the
Docker Sandboxes lab. It covers what lives here and how to run it. The Simspace **format**
(`simulator.yaml`, `labspace.yaml`, milestones) is not documented here on purpose; see
[Where the format reference lives](#where-the-format-reference-lives) below.

The repository root has its own [`AGENTS.md`](../AGENTS.md) (rules for the hands-on lab and the
DevBoard app). Its rules apply here too, in particular: **never `git push` without explicit user
confirmation**, and keep changes small and focused.

## What this folder is

A translation of the hands-on lab ([`../instructions/`](../instructions)) into a
[Simspace](https://github.com/dockersamples/simspace): plain data (Markdown plus YAML) under
`labs/`, run by a prebuilt image (`dockersamples/simspace`). You never touch app source, and
there's no build step. The `labs.json` catalog is **generated**: never write or commit it.

```
labs/docker-sandboxes-copilot/   # the lab; the directory name is its id
  labspace.yaml                  # title, 4 terminals, sections + milestones, seed files
  simulator.yaml                 # the scenarios: command/prompt (when) -> output, state, files (then)
  welcome.md, 01-…12-*.md        # one file per section, numbered like ../instructions/ (no 00:
                                 # the prerequisites have nothing to simulate)
  troubleshooting.md
tools/replay.ts                  # headless replay of the whole lab (see below)
.sbxenv.yaml                     # `sbx env run`: the sandbox that carries the authoring skills
compose.yaml                     # up dev / run --rm validate / run --rm replay
Dockerfile                       # optional: serve the labs from a container
CLAUDE.md                        # loads this guide in Claude Code
.claude/                         # pre-allowed commands + the post-edit validate hook
```

## The loop

```bash
docker compose up dev                 # live preview at http://localhost:5173
docker compose run --rm validate      # structure: ALWAYS before committing
docker compose run --rm replay        # behaviour: plays every Run button, in order
```

- `validate` exits non-zero on dangling references, commands that match no scenario, unknown
  milestones. Its 13 warnings about `mermaid` blocks having a Run button are known and harmless: the
  app renders them as diagrams.
- `replay` catches what `validate` can't: a block that matches no scenario *in the state a learner
  has reached*, a block that lands on an error path (`create-wrong-dir`, `git-merge-blocked`,
  `run-not-found`…), a milestone nothing completes. It must end with `steps NOT completed: none` and
  `problems: none`. Run it after any change to a scenario or a section.
- In Claude Code, a PostToolUse hook (`.claude/`) runs `validate` after edits under `labs/`.

**Definition of done:** `validate` is green, `replay` is clean, every hands-on section has at least
one milestone, and you've eyeballed anything visual in `docker compose up dev`.

## Translating the hands-on lab

- **`../instructions/` is the source of truth.** Keep section order, wording of the commands and
  prompts, and the numbers (test counts, CVE counts, ports) identical. When the hands-on lab changes,
  change the section, the scenarios behind it and the milestones; bump `version:` in `labspace.yaml`
  when a milestone is added, removed or renamed.
- **Only simulate what the lab shows.** A command whose output the lab doesn't show stays
  unsimulated (it falls to `defaults.unmatched`); don't invent output for it. Where the real output
  isn't documented and the lab needs one (`sbx ls`, `sbx policy log`, the TUI), keep it minimal and
  mark it abridged.
- **Seed files are the real project files**, copied from `../project` into `labspace.yaml`'s
  `files:` (the scenarios edit them: the pagination fix, the merged agent work). After changing
  DevBoard, refresh them; never hand-edit a copy.
- **State drives everything.** Gate a scenario on `when.state` so the same command behaves
  differently at different moments (`sbx policy ls`, the full test suite, `git status`). Keep
  scenarios that edit files (`replace`) behind a state flag: a `replace` whose `find` is missing is
  a hard error, so a repeated prompt would crash the lab.
- **One command per runnable block**, no `#` comments in them (use `no-run-button` for blocks that
  must not run). Agent prompts are ```` ```prompt ```` blocks; leave a session with a ```` ```prompt ````
  block containing `/exit`.
- **Pick the terminal explicitly** (`terminal-id=t2`) for anything that isn't the default Terminal 1,
  and never leave a session open in the terminal a later block expects to be a host shell.

### Engine quirks that shaped the scenarios

- The flag parser is greedy: `--flag value` consumes the next non-flag token. So
  `sbx rm --force a b` arrives as `sbx rm b` with `force=a`; `git merge --no-edit x` arrives with
  `no-edit=x`; `curl -I url` has no positional. Match what the parser produces, not what you'd type.
- `command:` is a **prefix** match, so a bare `[sbx]` also matches `sbx anything`; the TUI scenario
  adds `args: { 0: false }` to mean "no positional".
- First match wins, and `when.state` compares equality only: put the most specific scenario first.
- Inside a session every line is an agent prompt (matched by `promptContains`); only `!cmd` reaches
  the command scenarios. `then.mcp` output is appended *after* `then.output`, so the MCP tool calls
  are written into `output` instead, to keep the order.
- The four terminals share one state tree; `when.terminal` is the only thing that tells them apart
  (used for `docker ps`).

## Where the format reference lives

**Not in this folder.** It ships in the
[`simspace-authoring-kit`](https://hub.docker.com/r/dockersamples/simspace-authoring-kit) sandbox kit,
named by [`.sbxenv.yaml`](.sbxenv.yaml) and resolved fresh every time a sandbox is created:

```console
$ sbx env run
```

That gives you Claude Code with the **authoring-lab**, **authoring-slidedeck** and
**importing-slidedeck** skills already installed, versioned with the platform.

If you are working **without** a sandbox, read the authoritative specs directly:
[`dockersamples/simspace`](https://github.com/dockersamples/simspace) → `spec/simulator.md`,
`spec/labspace.md`, `spec/catalog.md`, `spec/slidedeck.md`. They are normative.

> [!IMPORTANT]
> If you add a markdown formatter, **exclude `labs/`**: `---` is the slide separator in decks, and
> formatters rewrite `***` and `___` to it.
