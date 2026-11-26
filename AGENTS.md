# Agent guidance

This repository holds a Docker Sandboxes lab. The application you work on is **DevBoard**, in the
[`project/`](project/) folder: a FastAPI backend (`project/backend`) and a Next.js frontend (`project/frontend`).
Read [`project/AGENTS.md`](project/AGENTS.md) and [`project/README.md`](project/README.md) before changing code.

## Rules

- **Never `git push` without explicit user confirmation.** Stage and commit when asked, then stop and ask before pushing.
- Keep changes small and focused on the task you were given. Do not reformat or refactor unrelated code.
- Never commit generated or local files: `*.db`, `.env`, `node_modules/`, `.next/`, `__pycache__/`, `.venv/`.

## Sandbox environment

You are most likely running in a Docker Sandbox (a Linux microVM, user `agent`, with `sudo`). Its image has
**no Node.js**, and **no Python** unless the sandbox was created with the lab's DevBoard kit (`project/kits/devboard`).
The network is locked down: only GitHub, Copilot, Debian packages (`apt`), PyPI, Docker Hub and npm are allowed.
If a download is blocked, tell the user which host it needs instead of working around it.

- If `python3` is missing, install it once, before running any backend command:
  `sudo apt-get update && sudo apt-get install -y python3 python3-venv python3-pip`
- Create the virtual environment **outside the workspace** (the workspace is a folder shared with the host,
  which must stay clean): `python3 -m venv ~/venv && ~/venv/bin/pip install -r project/backend/requirements.txt`
- Run the tests with `cd project/backend && ~/venv/bin/pytest -v`
- Docker and Docker Compose are available inside the sandbox.
