# Troubleshooting

## In this simulation

| Problem | Solution |
|---------|----------|
| The terminal says "This command isn't part of the lab" | The simulation only knows the commands the modules ask you to run, written the way they are written there. Use the **Run** buttons, or check for a typo. |
| A prompt answers "This prompt isn't part of the lab" | Use the **Run** button on the prompt blocks: the agent's answers are scripted for those exact requests. |
| The terminal prompt changed and my commands are ignored | You are inside an agent session, where what you type is a prompt. Type `/exit` to go back to your host. Start a line with `!` to run a command without leaving the session. |
| A command says a sandbox, an MCP server or a Git remote doesn't exist | You skipped a step, or ran one in a different order. Check the earlier module, or press **Reset** and start the module again: your progress is kept. |
| The four terminals share one state | They are four shells on the same simulated machine, like in the real lab: a `cd` in one applies to all of them. |
| Something looks wrong after many experiments | Press **Reset**: it restores the simulated machine, its files and the policies to their starting state. |

## In the real lab

Run `sbx diagnose` first: it checks the most common installation problems.

| Problem | Solution |
|---------|----------|
| `sbx create` fails because the sandbox name already exists | Remove the old sandbox with `sbx rm <name>` (see the names with `sbx ls`), then create it again. |
| The agent can't install packages or reach a website | The lab runs with the **Locked Down** policy, so only the hosts allowed in *Network policies* are reachable. Check that those rules exist with `sbx policy ls`, then run `sbx policy log` to see which hosts were blocked. Allow what is needed with `sbx policy allow network <host>`, or use the **Network** panel of the TUI (`sbx`, then `Tab`). |
| `sbx policy ls` shows policies whose `SOURCE` is not `local` | Your organization manages your sandbox policies and some exercises may be blocked. Use a personal Docker account or ask your administrator. |
| The agent can't authenticate to GitHub or Copilot | Run `gh auth status`, then store the secrets again **before** creating the sandbox. Global secrets are injected at creation time, so recreate the sandbox if you added them afterwards. |
| `git fetch sandbox-<name>` fails with `'sandbox-<name>' does not appear to be a git repository` | The sandbox must be running, and a sandbox stops when its agent session ends. Start it again without a new session with `sbx run --detach --name <name>`, then fetch. |
| `sbx run --clone` fails with `--clone requires a Git repository` | Run it from the root of the repository (`cd ..` if you are in `project/`), not from the `project` folder. |
| The agent says that Python (or Node.js) is not installed | The sandbox image doesn't include them. Sandboxes created with `--kit ./kits/python` have Python; for the others, the agent is told how to install it in `AGENTS.md`. |
| `localhost:3001` or `localhost:8000` stopped answering | The sandbox stopped because no agent session was attached. Restart it with `sbx run --detach --name quickstart`; the services and the published ports come back by themselves. |
| The agent in the `dhi` sandbox has no `dhi` tools | Check that `sbx mcp ls` shows `dhi` as `ready` (run `sbx mcp add` again to re-authorize). A sandbox's MCP servers are set when it is created: if `mcp` was created before `dhi` was ready, load it with `sbx mcp load dhi --sandbox mcp`, then exit the agent session and reconnect with `sbx run --name mcp`. |
| `git merge` refuses to run because of local changes | Commit your changes first: run `git add -A`, then `git commit`. |
| A command in the sandbox prints `Approval required for <host>:<port>.` | The network policy blocked that host. If the lab needs it, allow it with `sbx policy allow network <host>`, or grant this one request with `sbx policy approval ls`. |
| Windows PowerShell prints red `NativeCommandError` text after a command that worked | Windows PowerShell 5.1 shows anything a program writes to its error stream as an error. If the command's result is what you expected, ignore it. |
| `sbx port ls` shows `No published ports` | The sandbox is stopped. Run `sbx run --detach --name <name>`; the ports come back. |
| A command with `&&` fails in Windows PowerShell | Windows PowerShell 5.1 doesn't support `&&`: run the two commands one after the other. |

Still stuck? [Open an issue](https://github.com/mathieu-benoit/sbx-lab/issues) and include the output of `sbx version` and `sbx diagnose`.
