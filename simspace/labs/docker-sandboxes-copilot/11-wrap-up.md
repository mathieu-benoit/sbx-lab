# Wrap up

You've completed **Docker Sandboxes with GitHub Copilot**. Well done!

You now know how to:

- Control which network destinations your agents can reach with **network policies**.
- Read an agent's **kit** to see what it runs and what it's given, and read a mixin.
- Keep your **credentials** out of the agent's reach while still letting it authenticate.
- Run an agent in **direct mode**, or in isolated **clone mode** with several agents **in parallel**, and review their work before merging it.
- Monitor your sandboxes and their network activity from the **TUI dashboard** and with `sbx policy log`.
- Run **Docker inside a sandbox** and reach the services with **port forwarding**.
- Give your agent tools through the **MCP gateway** without opening its network.

## Clean up

In the real lab, this is what you leave on your machine, and how to remove it:

```mermaid
graph LR
    You(["You"])

    subgraph Lab["What the lab left on your machine"]
        direction TB
        Sandboxes["Sandboxes<br/>quickstart, fix-bugs, add-search, add-notif, mcp, shell-demo"]
        McpRegistration["DHI MCP registration"]
        Secrets["github and copilot secrets"]
        Policy["Locked Down policy<br/>and the lab's rules"]
    end

    You -->|sbx rm| Sandboxes
    You -->|sbx mcp rm dhi| McpRegistration
    You -->|sbx secret rm| Secrets
    You -->|"keep it, or sbx policy reset"| Policy

    style Lab fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Sandboxes fill:#e0f2e6,stroke:#6db88a,color:#384D54
    style McpRegistration fill:#fff,stroke:#0DB7ED,color:#384D54
    style Secrets fill:#fff,stroke:#0DB7ED,color:#384D54
    style Policy fill:#fff,stroke:#0DB7ED,color:#384D54
    style You fill:#fff,stroke:#1D63ED,color:#00084D
```

First, if the `quickstart` agent session from the *Docker inside the sandbox* module is still open in Terminal 1, leave it:

```prompt id=sandbox terminal-id=t1
/exit
```

Then remove the sandboxes created during the lab, along with everything inside them (images, containers, and data). The real `sbx rm` asks for confirmation (add `--force` to skip it); the simulation doesn't:

```bash id=host
sbx ls
```

```bash id=host
sbx rm quickstart fix-bugs add-search add-notif mcp
```

`shell-demo` is the sandbox from the network policies module:

```bash id=host
sbx rm shell-demo
```

`sbx prune` removes all stopped sandboxes at once, including ones that aren't from this lab, so use it with care.

> **Note:** for the three clone-mode sandboxes (`fix-bugs`, `add-search`, `add-notif`), the real `sbx rm` warns that commits made inside them are lost unless you fetched them first. You did, and you merged them, so you lose nothing. Fetched branches are also kept in your repository under `refs/sandboxes/<name>/*` after removal, and `git branch <local-name> refs/sandboxes/<name>/main` recovers one.

If you don't want to keep the DHI MCP server, remove its registration:

```bash id=host
sbx mcp rm dhi
```

Remove the GitHub token you stored in the *Secrets and credentials* module from your OS keychain (skip this if you use these two secrets for other work):

```bash id=host
sbx secret rm github -f
```

```bash id=host
sbx secret rm copilot -f
```

Your network policy is still **Locked Down**, with the rules you added for the lab (check with `sbx policy ls`). Keep it, adding hosts as your projects need them, or go back to the **Balanced** profile:

```bash id=host
sbx policy reset --force
```

```bash id=host
sbx policy init balanced
```

## Next steps

- Do the real thing: the [hands-on lab](https://github.com/mathieu-benoit/sbx-lab) runs on your own machine, with a real Copilot agent.
- [Get Started with Docker Sandboxes learning path](https://docs.docker.com/learn/paths/get-started-with-docker-sandboxes/)
- [Build and customize Docker Sandbox environments learning path](https://docs.docker.com/learn/paths/build-and-customize-docker-sandbox-environments/)
- [Docker Sandboxes documentation](https://docs.docker.com/ai/sandboxes/)
- [Sandboxes versus containers](https://www.docker.com/products/docker-sandboxes/vs-containers/)
- [Docker Sandbox Kit specification](https://github.com/docker/sandbox-kit-spec)

## Feedback

Did you find a problem or have an idea to improve this lab? [Open an issue](https://github.com/mathieu-benoit/sbx-lab/issues). Thank you for joining!
