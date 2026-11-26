# Network policies

Every sandbox routes outbound HTTP/HTTPS through a host-side proxy that enforces access rules you define. There are three built-in postures:

| Policy      | Description                                                                          |
|-------------|--------------------------------------------------------------------------------------|
| Open        | All traffic allowed, no restrictions                                                 |
| Balanced    | Default deny, with a broad allow-list covering AI APIs, npm, pip, GitHub, registries |
| Locked Down | Everything blocked; you explicitly allow what you need                               |

In this lab you will use **Locked Down**, and let each sandbox's kits allow only the hosts its exercises need.

```mermaid
graph LR
    You(["You"])

    subgraph Host["Your machine"]
        direction TB
        Rules["Policy rules<br/>Locked Down + each kit's rules"]
        Proxy["Proxy"]
        Log["sbx policy log"]
    end

    subgraph Sandbox["Sandbox: shell"]
        direction TB
        Curl["curl docker.com"]
    end

    subgraph Allowed["Allowed hosts"]
        direction TB
        GitHub["GitHub and Copilot"]
        Packages["Debian, PyPI, Docker Hub, npm"]
    end

    subgraph Blocked["Everything else"]
        direction TB
        Other["docker.com, any other host"]
    end

    You -->|"sbx policy allow, deny, rm"| Rules
    Rules -->|decide| Proxy
    Curl -->|every request| Proxy
    Proxy -->|allowed| GitHub
    Proxy -->|allowed| Packages
    Proxy -.->|"denied: approval required"| Other
    Proxy -->|records| Log

    style Host fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Sandbox fill:#f0faf4,stroke:#86c5a0,color:#00084D
    style Allowed fill:#fff7f0,stroke:#d4915e,color:#00084D
    style Blocked fill:#fff5f5,stroke:#e57373,color:#00084D
    style Rules fill:#fff,stroke:#0DB7ED,color:#384D54
    style Proxy fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Log fill:#fff,stroke:#0DB7ED,color:#384D54
    style Curl fill:#e0f2e6,stroke:#6db88a,color:#384D54
    style GitHub fill:#fff0e5,stroke:#d4915e,color:#384D54
    style Packages fill:#fff0e5,stroke:#d4915e,color:#384D54
    style Other fill:#fff,stroke:#e57373,color:#384D54
    style You fill:#fff,stroke:#1D63ED,color:#00084D
```

## Test the Locked Down profile

> **Warning:** `sbx policy reset` **deletes every network rule you have created on this machine**, not only the lab's. If you use `sbx` for other work, save your current rules first with `sbx policy ls` and re-add them afterwards.

Reset the policies, then choose the default without the interactive picker:

```bash id=host
sbx policy reset --force
```

```bash id=host
sbx policy init deny-all
```

> **Tip:** plain `sbx policy reset` shows a picker instead. In this simulation it selects **Locked Down** for you.

Check the configured policies. You now see only `default-deny-all` and a `local-policy` with no network rule:

```bash id=host
sbx policy ls
```

Check whether `docker.com` is reachable under this policy:

```bash id=host
sbx policy check network docker.com
```

It's `Denied`: *no matching allow rule (default deny)*.

Now start your **first sandbox**: a microVM with just a shell, no agent yet. The current folder is its workspace, and `--name` gives it a name you will reuse when you clean up:

```bash id=host
sbx run shell --name shell-demo
```

Your prompt changes: you're now inside the sandbox. Try to reach `docker.com` from there:

```prompt id=sandbox
curl docker.com
```

The request never left your machine: the host-side proxy blocked it and filed a **pending approval**. You could grant it from the host with `sbx policy approval`, or from the TUI dashboard. The difference: **approving** answers this one request, while **allowing** (`sbx policy allow network`) adds a rule that applies to every sandbox from then on.

Leave this sandbox to return to your host:

```prompt id=sandbox
/exit
```

## See what the sandbox is hitting

To view the hosts that were allowed or blocked by the proxy, use `sbx policy log`:

```bash id=host
sbx policy log
```

Add `--json` for a machine-readable output.

## Allow additional hosts

Use `sbx policy allow network` to allow communication with `docker.com`:

```bash id=host
sbx policy allow network docker.com
```

Check it again; it's now `Allowed`:

```bash id=host
sbx policy check network docker.com
```

Reconnect to the sandbox and try again, showing only the response headers:

```bash id=host
sbx run --name shell-demo
```

```prompt id=sandbox
curl -I docker.com
```

This time `docker.com` answers itself, with a `301 Moved Permanently` redirect to HTTPS, instead of the proxy's approval message.

```prompt id=sandbox
/exit
```

> **Tip:** you can allow several hosts in a single command, and use wildcards: `*.example.com` matches exactly one subdomain level (`api.example.com`), `**.example.com` matches any depth (`api.eu.example.com`). Neither matches `example.com` itself.
>
> ```bash id=host no-run-button
> sbx policy allow network "smtp.mailgun.org,api.sendgrid.com"
> sbx policy allow network "**.npmjs.org"
> ```

## Block a host, then clean up

To explicitly block a host, use `sbx policy deny`:

```bash id=host
sbx policy deny network ads.example.com
```

Each rule you define manually is stored separately. Remove them with `sbx policy rm` (the real command asks you to confirm; add `--force` to skip the question):

```bash id=host
sbx policy rm network --resource docker.com
```

```bash id=host
sbx policy rm network --resource ads.example.com
```

## Reaching host services from inside the sandbox

If a service runs on your host (a local Ollama, a database), `localhost` inside the sandbox is the sandbox itself. Use the name `host.docker.internal`, which the proxy routes to your host. The policy rule names the service as your host sees it, `localhost:<port>`, so you decide which ports of your own machine are reachable, one by one. You don't need this for the lab:

```bash id=host no-run-button
sbx policy allow network localhost:11434
```

Then point the client in the sandbox at `host.docker.internal:11434`.

## Keep Locked Down for the rest of the lab

You keep the **Locked Down** policy for the rest of the lab, without adding any host to it: rather than trusting a broad allow list, each sandbox gets exactly the hosts its **kits** declare, for that sandbox only. You'll read those kits in the next module.

Check your policy. You removed the rules you added above, so it's back to Locked Down, with no network rule of your own:

```bash id=host
sbx policy ls
```

Check a host your agents will use. `sbx policy check` reads your global policy, which allows nothing: `api.github.com` will only be reachable from the sandboxes whose kits allow it, such as every Copilot sandbox:

```bash id=host
sbx policy check network api.github.com
```

| Hosts | Used for | Declared by |
|-------|----------|-------------|
| `github.com`, `api.github.com`, `api.*.githubcopilot.com`, `copilot.github.com` | The Copilot agent, and the GitHub API | The Copilot kit, `sbx/copilot` |
| `deb.debian.org:80`, `dhi.io:80` | The sandbox image's `apt` repositories, to install Python | The DevBoard kit, during the install |
| `pypi.org`, `files.pythonhosted.org` | The backend's Python packages | The DevBoard kit |
| `**.docker.io`, `production.cloudfront.docker.com` | Pulling the `python`, `node` and `postgres` images, and the images Trivy and Docker Scout read | The DevBoard kit |
| `dhi.io:443` | The Docker Hardened Images registry, read by Trivy and Docker Scout | The DevBoard kit |
| `registry.npmjs.org` | The frontend's npm packages | The DevBoard kit |
| `mirror.gcr.io`, `ghcr.io`, `raw.githubusercontent.com`, `codeload.github.com`… | Trivy's vulnerability database, and the VEX statements | The Trivy kit |
| `api.dso.docker.com`, `api.scout.docker.com` | The Docker Scout service | Docker's Scout kit, `sbx/scout-cli` |

Every host is on port 443 (HTTPS), except the `apt` repositories, read over plain HTTP on port 80. Copilot also calls telemetry hosts, such as `telemetry.*.githubcopilot.com` and `cafe.github.com`, that no kit allows: they show as blocked in `sbx policy log`, and Copilot works without them.

> **Tip:** if an agent later fails to download something, run `sbx policy log` to see the blocked host. Then allow it for that sandbox only, with `sbx policy allow network <host> --sandbox <name>`, or add it to the kit that needs it.
