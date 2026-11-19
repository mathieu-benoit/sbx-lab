# 🛟 Troubleshooting

Run `sbx diagnose` first: it checks the most common installation problems.

| Problem | Solution |
|---------|----------|
| `sbx diagnose` reports `✗ Daemon diagnostics — check timed out` | If the line above it shows `✓ Daemon — healthy` and the other required checks pass, you can continue: in a full run of the lab on Windows with `sbx` v0.54.0, this check timed out every time, and every module still worked. |
| `sbx create` fails because the sandbox name already exists | Remove the old sandbox with `sbx rm <name>` (see the names with `sbx ls`), then create it again. |
| The agent can't install packages or reach a website | The lab runs with the **Locked Down** policy, so only the hosts allowed in [Network policies](01-network-policies.md#allow-only-what-the-lab-needs) are reachable. Check that those rules exist with `sbx policy ls`, then run `sbx policy log` to see which hosts were blocked. Allow what is needed with `sbx policy allow network <host>`, or use the **Network** panel of the TUI (`sbx`, then `Tab`). |
| `sbx policy ls` shows policies whose `SOURCE` is not `local` | Your organization manages your sandbox policies and some exercises may be blocked. Use a personal Docker account or ask your administrator. |
| The agent can't authenticate to GitHub or Copilot | Run `gh auth status`, then store the secrets again **before** creating the sandbox (see [Secrets and credentials](03-secrets-credentials.md)). Global secrets are injected at creation time, so recreate the sandbox if you added them afterwards. |
| `git fetch sandbox-<name>` fails with `'sandbox-<name>' does not appear to be a git repository` | The sandbox must be running, and a sandbox stops when its agent session ends: `sbx` then removes its Git remote. Start it again without a new session with `sbx run --detach --name <name>`; the remote comes back, and you can fetch. |
| `git status` shows an untracked, empty `shim-start.lock` file | `sbx` v0.54 creates it in the folder where its daemon starts, for example when `sbx policy reset` restarts the daemon. It isn't part of the lab: the repository's `.gitignore` skips it, and you can delete it. |
| `sbx run --clone` fails with `--clone requires a Git repository` | Run it from the root of the repository (`cd ..` if you are in `project/`), not from the `project` folder. |
| The agent says that Python (or Node.js) is not installed | The sandbox image doesn't include them. Sandboxes created with `--kit ./kits/python` (see [Agent sandbox](04-first-sandbox.md)) have Python; for the others, the agent is told how to install it in `AGENTS.md`; if it still gives up, ask it to follow the "Sandbox environment" section of `AGENTS.md`. |
| `localhost:3001` or `localhost:8000` stopped answering | The sandbox stopped because no agent session was attached. Restart it with `sbx run --detach --name quickstart`; the services and the published ports come back by themselves. |
| The agent in the `dhi` sandbox has no `dhi` tools | Check that `sbx mcp ls` shows `dhi` as `ready` (run `sbx mcp add` again to re-authorize). A sandbox's MCP servers are set when it is created: if `mcp` was created before `dhi` was ready, load it with `sbx mcp load dhi --sandbox mcp`, then exit the agent session and reconnect with `sbx run --name mcp`. |
| `git merge` refuses to run because of local changes | Commit your changes first: run `git add -A`, then `git commit`. |
| A command in the sandbox prints `Approval required for <host>:<port>.` | The network policy blocked that host. If the lab needs it, allow it with `sbx policy allow network <host>`, or grant this one request with `sbx policy approval ls`. |
| Windows PowerShell prints red `NativeCommandError` text after `git fetch`, `sbx rm` or another command that worked | Windows PowerShell 5.1 shows anything a program writes to its error stream (progress and warnings, for example) as an error. If the command's result is what you expected, ignore it. |
| `sbx port ls` shows `No published ports` | The sandbox is stopped. Run `sbx run --detach --name <name>`; the ports come back. |
| A command with `&&` fails in Windows PowerShell | Windows PowerShell 5.1 doesn't support `&&`: run the two commands one after the other. |
| The browser can't open the app on `localhost:3001` or `localhost:8000` | Check that the stack is still running in the sandbox (`docker ps` from the agent), that the ports are published (`sbx port ls quickstart`), and that the servers listen on `0.0.0.0`. |
| Docker Compose in the sandbox is slow the first time | It has to pull images and install dependencies. Subsequent runs are much faster. |

Still stuck? [Open an issue](https://github.com/mathieu-benoit/sbx-lab/issues) and include the output of `sbx version` and `sbx diagnose`.

[[Home](../README.md)]
