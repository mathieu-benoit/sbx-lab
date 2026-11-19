# 🔒 Network policies

Every sandbox routes outbound HTTP/HTTPS through a host-side proxy that enforces access rules you define. There are three built-in postures:

| Policy      | Description                                                                          |
|-------------|--------------------------------------------------------------------------------------|
| Open        | All traffic allowed — no restrictions                                                |
| Balanced    | Default deny, with a broad allow-list covering AI APIs, npm, pip, GitHub, registries |
| Locked Down | Everything blocked; you explicitly allow what you need                               |

In this lab you will use **Locked Down**, and allow only the hosts the exercises need.

```mermaid
graph LR
    You(["You"])

    subgraph Host["Your machine"]
        direction TB
        Rules["Policy rules<br/>Locked Down + lab allow list"]
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

    %% Styles — containers
    style Host fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Sandbox fill:#f0faf4,stroke:#86c5a0,color:#00084D
    style Allowed fill:#fff7f0,stroke:#d4915e,color:#00084D
    style Blocked fill:#fff5f5,stroke:#e57373,color:#00084D

    %% Styles — host nodes
    style Rules fill:#fff,stroke:#0DB7ED,color:#384D54
    style Proxy fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Log fill:#fff,stroke:#0DB7ED,color:#384D54

    %% Styles — sandbox nodes
    style Curl fill:#e0f2e6,stroke:#6db88a,color:#384D54

    %% Styles — external nodes
    style GitHub fill:#fff0e5,stroke:#d4915e,color:#384D54
    style Packages fill:#fff0e5,stroke:#d4915e,color:#384D54
    style Other fill:#fff,stroke:#e57373,color:#384D54

    %% Styles — actor
    style You fill:#fff,stroke:#1D63ED,color:#00084D
```

To view the existing policies, use the `sbx policy ls` command:

```bash id=host
sbx policy ls
```

## Test the `Locked Down` network policies profile

Run this command to set the default:

> [!WARNING]
> `sbx policy reset` **deletes every network rule you have created on this machine**, not only the lab's. If you use `sbx` for other work, save your current rules first with `sbx policy ls` and re-add them afterwards.

```bash id=host
sbx policy reset
```

The CLI restarts the daemon, resets the policies, and shows a picker. Choose the **Locked Down** option (all network traffic is blocked unless you allow it).

> [!TIP]
> To do the same without the interactive picker, run these two commands:
>
> ```bash id=host
> sbx policy reset --force
> ```
>
> ```bash id=host
> sbx policy init deny-all
> ```

Check the configured policies:

```bash id=host
sbx policy ls
```

You should now see this:

```none id=host
  POLICY             SOURCE   APPLIES TO   SUMMARY
  default-deny-all   local    all          network: deny when no rule decides
  local-policy       local    all          filesystem read: 1 allow; filesystem write: 1 allow
```

Check whether `docker.com` is reachable under this policy:

```bash id=host
sbx policy check network docker.com
```

You will see this message:

```none id=host
    Denied:      docker.com:443
    Governance:  Local policy only
    Context:     global
    Reason:      no matching allow rule (default deny)
```

Now start your **first sandbox**: a microVM with just a shell, no agent yet. The current folder is its workspace, and `--name` gives it a name you will reuse when you clean up:

```bash id=host
sbx run shell --name shell-demo
```

Your prompt changes: you're now inside the sandbox. Try to reach `docker.com` from there:

```bash id=sandbox
curl docker.com
```

You will see this message:

```none id=sandbox
Approval required for docker.com:80.

Review and respond with:
  sbx policy approval ls
```

The request never left your machine: the host-side proxy blocked it and filed a **pending approval**. You could grant it from the host with `sbx policy approval`, or from the [TUI dashboard](05-tui-dashboard.md). The difference: **approving** answers this one request, while **allowing** (`sbx policy allow network`) adds a rule that applies to every sandbox from then on. In this module you'll add a rule. Adding it doesn't answer the pending approval: it stays in `sbx policy approval ls` until you respond to it or remove the sandbox, so don't be surprised to see it again in the dashboard.

Exit this sandbox to return to your host:

```bash id=sandbox
exit
```

## See what the sandbox is hitting

To view a list of the hosts that were allowed or blocked by the proxy, use the `sbx policy log` command:

```bash id=host
sbx policy log
```

You should see output similar to the following:

```none id=host
  BLOCKED REQUESTS
  SANDBOX           TYPE      HOST                                         PROXY     RULE                                                                                                                    REASON                                  LAST SEEN        COUNT
  shell-demo        network   docker.com:80                                forward   no applicable policies for op(action=net:connect:tcp, resource=net:domain:docker.com:80)                                No matching allow rule (default deny)   11:03:48 7-Nov   2
```

Adding the `--json` flag will output the log details in a machine-readable JSON format.

## Allow additional hosts

As you can see, the list of allowed hosts is small to begin with. However, it is easy to modify the list.

Use the `sbx policy allow network` command to allow communication with `docker.com`:

```bash id=host
sbx policy allow network docker.com
```

Check `docker.com` again:

```bash id=host
sbx policy check network docker.com
```

You will see this message:

```none id=host
    Allowed:     docker.com:443
    Governance:  Local policy only
    Context:     global
    Rule:        e3246d5b-cb8e-42d5-879d-45efeb4b2a4a
```

The `Rule` line names the rule that allowed the request: it's the ID that `sbx policy allow network` printed when it added the rule (`Added rule e3246d5b-… to policy local`). Yours is different.

Reconnect to the sandbox:

```bash id=host
sbx run --name shell-demo
```

Once in the sandbox, try to reach `docker.com` again, showing only the response headers:

```bash id=sandbox
curl -I docker.com
```

This time `docker.com` answers itself, with a `301 Moved Permanently` redirect to HTTPS, instead of the proxy's approval message. Type `exit` to return to your host.

> [!TIP]
> You can allow several hosts in a single command, and use wildcards: `*.example.com` matches exactly one subdomain level (`api.example.com`), `**.example.com` matches any depth (`api.eu.example.com`). Neither matches `example.com` itself.
>
> ```bash id=host
> # Allow several hosts at once
> sbx policy allow network "smtp.mailgun.org,api.sendgrid.com"
>
> # Allow every subdomain of npmjs.org, at any depth
> sbx policy allow network "**.npmjs.org"
> ```

## Block a host

To explicitly block a host, use the `sbx policy deny` command:

```bash id=host
sbx policy deny network ads.example.com
```

## Removing custom policies

Each rule you define manually is stored separately. To remove them, use the `sbx policy rm` command, and confirm when it asks (add `--force` to skip the question):

1. Remove the allow rule for `docker.com`:

    ```bash id=host
    sbx policy rm network --resource docker.com
    ```

2. Remove the deny rule for `ads.example.com`:

    ```bash id=host
    sbx policy rm network --resource ads.example.com
    ```

## Reaching host services from inside the sandbox

If you have a service running on your host machine (for example a local Ollama instance or a database), you can't reach it via `localhost` from inside the sandbox, because `localhost` there is the sandbox itself.

Inside the sandbox, use the name `host.docker.internal`, which the proxy routes to your host. The policy rule, on the other hand, names the service as your host sees it, `localhost:<port>`: you decide which ports of your own machine are reachable, one by one. You don't need to run this command for the lab:

```bash id=host
sbx policy allow network localhost:11434
```

Then inside the sandbox, point your client at `host.docker.internal:11434`.

## Allow only what the lab needs

You will keep the **Locked Down** policy for the rest of the lab: rather than trusting a broad allow list, you allow exactly the hosts your agents need, and nothing else.

Add these four rules:

```bash id=host
# GitHub and GitHub Copilot: the agent itself
sbx policy allow network "github.com:443,**.github.com:443,**.githubcopilot.com:443"

# Python for the backend tests: Debian packages and PyPI
sbx policy allow network "deb.debian.org:80,dhi.io:80,dhi.io:443,pypi.org:443,files.pythonhosted.org:443"

# Docker: pulling images from Docker Hub
sbx policy allow network "**.docker.io:443,production.cloudfront.docker.com:443"

# Node.js: installing the frontend's npm packages
sbx policy allow network "registry.npmjs.org:443"
```

| Rule | Used by | Module |
|------|---------|--------|
| `github.com:443`, `**.github.com:443` | GitHub API, used by Copilot; also where Trivy downloads the VEX statements | all agent modules, [MCP servers](10-mcp-servers.md) |
| `**.githubcopilot.com:443` | Copilot service; the subdomain depends on your plan (`api.individual…`, `api.business…`, `api.enterprise…`), hence `**` | all agent modules |
| `deb.debian.org:80`, `dhi.io:80`, `dhi.io:443` | The sandbox image's `apt` repositories (Debian and Docker Hardened Images), used to install Python, which the image doesn't include, over HTTP (port 80). The Python kit you'll build in the next module declares them too, for the sandboxes that use it. `dhi.io` is also the Docker Hardened Images registry, where Trivy reads the hardened images it scans, over HTTPS (port 443) | [Kits](02-kits.md), [Run in direct mode](06-run-in-direct-mode.md), MCP servers |
| `pypi.org:443`, `files.pythonhosted.org:443` | Installing the backend's Python packages | Run in direct mode, Clone mode, [Docker inside the sandbox](08-docker-inside-the-sandbox.md) |
| `**.docker.io:443`, `production.cloudfront.docker.com:443` | Pulling the `python`, `node` and `postgres` images from Docker Hub, and reading the Docker Hub images that Trivy scans | Docker inside the sandbox, MCP servers |
| `registry.npmjs.org:443` | Installing the frontend's npm packages | Docker inside the sandbox |

A few more hosts are needed later, but you don't add them here: the kits that need them declare them, and those rules apply only to the sandboxes that use the kit. The Trivy kit, in [MCP servers](10-mcp-servers.md), adds `mirror.gcr.io` (Trivy's vulnerability database) and `raw.githubusercontent.com` (part of the VEX statements) for its sandbox only. You'll see the difference in that sandbox's network log.

Each rule ends with a **port**, so it allows that host on that port only. Everything is HTTPS (port 443), except the `apt` repositories: the sandbox image reads `deb.debian.org` and `dhi.io` over plain HTTP (port 80), so a `:443` rule alone would break `apt-get update`. `dhi.io` gets both ports, `:80` for its packages and `:443` for its image registry. A rule without a port would allow the host on any port.

List the policies again: `local-policy` now has one network rule per host and port.

```bash id=host
sbx policy ls
```

```none id=host
POLICY             SOURCE   APPLIES TO   SUMMARY
default-deny-all   local    all          network: deny when no rule decides
local-policy       local    all          network: 11 allow; filesystem read: 1 allow; filesystem write: 1 allow
```

Check a few of them:

```bash id=host
sbx policy check network api.github.com
sbx policy check network api.individual.githubcopilot.com
sbx policy check network docker.com
```

The first two are `Allowed`, both by a wildcard rule: `api.github.com` by `**.github.com:443` and the Copilot host by `**.githubcopilot.com:443` (each `Rule` line shows a different ID). A host without a port is checked on port 443. `docker.com` is still `Denied`, because you removed its rule above.

> [!TIP]
> If an agent later fails to download something, run `sbx policy log` to see the blocked host, then allow it with `sbx policy allow network <host>`.

[[<< Previous: Prerequisites](00-prerequisites.md) | [Next >> Kits](02-kits.md)]
