# Docker Sandboxes lab, as a Simspace

An interactive, fully in-browser version of the [Docker Sandboxes with GitHub Copilot lab](../README.md), built on [Simspace](https://github.com/dockersamples/simspace) with the [simspace-starter](https://github.com/dockersamples/simspace-starter) template. Instructions on the left, four simulated terminals on the right: every command and every agent answer is scripted, so it runs the same for everyone, with nothing to install, no Docker account and no Copilot usage allowance to spend.

Use it to preview the real lab before you take it, to revisit it afterwards, or to teach it where nobody can install `sbx`. The hands-on lab in [`instructions/`](../instructions) stays the reference; this folder is its translation.

## What's in the translation

One lab, [`labs/docker-sandboxes-copilot/`](labs/docker-sandboxes-copilot), with one section per module of the hands-on lab, a welcome page and the troubleshooting page. Each hands-on section has **milestones** (73 in total) that check off as the learner runs the right command in the right state.

| Section | Hands-on module | Simulated |
|---------|-----------------|-----------|
| Welcome | [README](../README.md) | How the simulation works, the "doors" diagram |
| Prerequisites | [00](../instructions/00-prerequisites.md) | `sbx version`, `login`, `diagnose`, `policy ls`, warm-up sandboxes |
| Network policies | [01](../instructions/01-network-policies.md) | Locked Down, a shell sandbox hitting the proxy, allow, deny, rm, the lab's four rules |
| Kits | [02](../instructions/02-kits.md) | `sbx kit inspect` and `validate`; the Python, Trivy and port kits as seed files |
| Secrets and credentials | [03](../instructions/03-secrets-credentials.md) | `sbx secret set`, `ls` |
| Agent sandbox | [04](../instructions/04-first-sandbox.md) | `sbx create` with a kit, the three isolation checks, the first agent session |
| TUI dashboard | [05](../instructions/05-tui-dashboard.md) | A snapshot of `sbx`, which changes as sandboxes appear |
| Run in direct mode | [06](../instructions/06-run-in-direct-mode.md) | Failing tests, the pagination fix (it really edits the virtual `issues.py`), `git diff`, `git commit` |
| Clone mode and parallel agents | [07](../instructions/07-parallel-agents.md) | `--clone`, two agents at once in separate terminals, `git fetch` and `git merge` (the merged code lands in the virtual files) |
| Docker inside the sandbox | [08](../instructions/08-docker-inside-the-sandbox.md) | Compose in the sandbox, `!docker ps` inside it vs `docker ps` on the host |
| Port forwarding | [09](../instructions/09-port-forwarding.md) | `sbx ports`, a kit that publishes a port; `curl` stands in for the browser |
| MCP servers | [10](../instructions/10-mcp-servers.md) | `sbx mcp add`, a `--static-mcp` sandbox, scripted DHI tool calls, the Trivy scan and its network log |
| Cloud sandboxes | [11](../instructions/11-cloud-sandboxes.md) | `sbx --cloud`: a cloud secret, `create` with a kit, the cloud policy, `cp`, an agent session, a public URL (`curl` stands in for the browser), TTL, stop and wake-up |
| Wrap up | [12](../instructions/12-wrap-up.md) | Cleanup |

### What differs from the real lab

- **Outputs are modelled, not captured.** They follow the hands-on lab's text and are abridged in places (a real `sbx` may format `policy ls`, `policy log`, `ls` or the kit inspector differently). Treat them as illustrative.
- **Agent sessions end with `/exit`** (in the real lab: Ctrl-C twice), and the agent only answers the lab's prompts. Inside a session, `!command` still runs a host command.
- **`curl` replaces the browser** in the port forwarding module.
- **Confirmations and pickers** are answered for you: `sbx policy rm` shows its question answered `y`, `sbx rm` skips it, and plain `sbx policy reset` auto-selects Locked Down.
- **Four terminals share one machine**, like the several terminals the real lab asks for. A `cd` in one applies to all.

## Author locally

You only need Docker.

```bash
docker compose up dev                 # live preview at http://localhost:5173
docker compose run --rm validate      # validate every lab (fails on errors)
docker compose run --rm replay        # play the whole lab through the engine
```

- `validate` checks the structure: dangling references, commands that match no scenario, unknown milestones. It warns that `mermaid` blocks have a Run button; ignore it, the diagrams render.
- `replay` ([`tools/replay.ts`](tools/replay.ts)) plays every runnable block in order, as the Run buttons would, and reports blocks that dead-end, blocks that land on an error path, and milestones that never complete. Run it after changing a scenario: `validate` can't see a state that makes a later step impossible. Add `-v` for the full output, with `docker compose run --rm replay node scripts/run-ts.mjs scripts/replay.ts /labs/docker-sandboxes-copilot -v`.

Edit the files under `labs/docker-sandboxes-copilot/` and refresh the browser:

- `labspace.yaml`: title, catalog card, the four terminals, sections and milestones, and the seed files of the virtual filesystem (real DevBoard files, copied from [`../project`](../project)).
- `simulator.yaml`: what each command and agent prompt does, gated on a small state tree.
- `*.md`: one file per section.

`labs.json` is generated; never commit it.

## Deploy

**GitHub Pages.** The [`pages`](../.github/workflows/pages.yaml) workflow publishes this folder in `simspace/` on the repository's Pages site (`https://<owner>.github.io/sbx-lab/simspace/`), on every push to `main` that changes it, with the steps of the template's reusable [`deploy-lab.yml`](https://github.com/dockersamples/simspace/blob/main/.github/workflows/deploy-lab.yml): validate the labs, take the runtime image's payload, add the labs and generate `labs.json`. They are inlined rather than called, because the same site also holds the static preview of the Labspace rendering, in `labspace/` (see [`../labspace-local`](../labspace-local)), with the hands-on lab at the root, rendered by the same runtime without terminals (see [`../.github/pages`](../.github/pages)), and a repository has a single Pages site. Enable Pages first (Settings → Pages → Source: "GitHub Actions").

**As a container.** The [`Dockerfile`](Dockerfile) serves the labs:

```bash
docker build -t sbx-lab-simspace .
docker run --rm -p 8080:80 sbx-lab-simspace    # http://localhost:8080
```

## Authoring with an AI agent

[`.sbxenv.yaml`](.sbxenv.yaml) describes a [Docker Sandbox](https://docs.docker.com/ai/sandboxes/) for authoring this folder: Claude Code with the Simspace authoring skills, Docker inside, ports 5173 and 8888 published. From this folder:

```bash
sbx env run
```

[`CLAUDE.md`](CLAUDE.md) loads [`AGENTS.md`](AGENTS.md), and a hook (`.claude/`) validates the labs after every edit under `labs/`.

## Keeping it in sync

The hands-on lab changes (an `sbx` release, a new module, a fixed command). When it does, update the matching section here: the markdown, the scenarios that produce the output, and the milestones (bump `version:` in `labspace.yaml` when you add, remove or rename one, so stored progress is reset). Then run `validate` and `replay`.
