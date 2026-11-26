# Agent guidance for DevBoard

DevBoard is a small issue tracker: a FastAPI backend (`backend/`) and a Next.js frontend
(`frontend/`), started together with Docker Compose. It is the sample app of a Docker Sandboxes lab.
See [`README.md`](README.md) for how to run it.

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
  which must stay clean): `python3 -m venv ~/venv && ~/venv/bin/pip install -r backend/requirements.txt`
- Run the tests with `cd backend && ~/venv/bin/pytest -v`
- Docker and Docker Compose are available inside the sandbox. You do not need Node.js on the sandbox itself:
  the frontend builds in its container.

## Commands

| Task                  | Command                                                                  |
|-----------------------|--------------------------------------------------------------------------|
| Run backend tests     | `cd backend && ~/venv/bin/pytest -v` (see *Sandbox environment* above)   |
| Start the whole stack | `docker compose up --build -d` (from this directory)                     |
| Build the frontend    | `cd frontend && npm ci && npm run build` (needs Node.js, or use Compose) |

## Conventions

- Backend: routers in `backend/app/routers/`, Pydantic schemas in `schemas.py`, models in `models.py`.
  Add or update a pytest test for every behaviour you change.
- Frontend: pages in `frontend/src/app/`, API calls only through `frontend/src/lib/api.ts`.
- Servers must listen on `0.0.0.0` (not `127.0.0.1`) so that sandbox port forwarding works.
- The backend tests use an in-memory SQLite database; they never need PostgreSQL.
