# Give your agent tools with MCP

Your agent can only reach the hosts you allowed in the network policies module. Sometimes it needs a capability rather than a website: that's what [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) servers provide.

Each sandbox has an **MCP gateway**. The agent only talks to the gateway; the MCP servers you register run **outside** the sandbox, on your host or as remote services. You give the agent new tools without opening its network.

In this module you give your agent the **Docker Hardened Images (DHI)** MCP server, so it can look up a hardened alternative to an image DevBoard uses. Then you scan those images with the **Trivy kit** from the *Kits* module.

```mermaid
graph LR
    You(["You"])

    subgraph Host["Your machine"]
        direction TB
        McpRegistry["Registered MCP servers<br/>sbx mcp add dhi"]
        Gateway["MCP gateway"]
        TrivyKit["Trivy kit<br/>project/kits/trivy"]
        Proxy["Proxy<br/>your rules + the kit's rules"]
    end

    subgraph Sandbox["Sandbox: mcp"]
        direction TB
        Agent["Copilot agent<br/>network still locked down"]
        Trivy["trivy and scan-images<br/>from the kit"]
    end

    subgraph Outside["Outside the sandbox"]
        direction TB
        Dhi["DHI MCP server<br/>dhi.io/mcp"]
        TrivySources["Trivy database and VEX<br/>mirror.gcr.io, GitHub"]
        Registries["Image registries<br/>Docker Hub, dhi.io"]
    end

    You -->|"sbx mcp add, --static-mcp dhi"| McpRegistry
    McpRegistry -->|configures| Gateway
    Agent -->|tool calls| Gateway
    Gateway -->|"calls, no network rule needed"| Dhi
    TrivyKit -->|"--kit, at sbx create"| Trivy
    You -->|"sbx exec mcp scan-images"| Trivy
    Trivy -->|every request| Proxy
    Proxy -->|"kit's rules"| TrivySources
    Proxy -->|"your rules"| Registries

    style Host fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Sandbox fill:#f0faf4,stroke:#86c5a0,color:#00084D
    style Outside fill:#fff7f0,stroke:#d4915e,color:#00084D
    style McpRegistry fill:#fff,stroke:#0DB7ED,color:#384D54
    style TrivyKit fill:#fff,stroke:#0DB7ED,color:#384D54
    style Gateway fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Proxy fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Agent fill:#e0f2e6,stroke:#6db88a,color:#384D54
    style Trivy fill:#e0f2e6,stroke:#6db88a,color:#384D54
    style Dhi fill:#fff0e5,stroke:#d4915e,color:#384D54
    style TrivySources fill:#fff0e5,stroke:#d4915e,color:#384D54
    style Registries fill:#fff0e5,stroke:#d4915e,color:#384D54
    style You fill:#fff,stroke:#1D63ED,color:#00084D
```

1. Register the DHI MCP server, from a terminal on your host (use Terminal 2: the `quickstart` session may still be open in Terminal 1). In the real lab, a browser window may open for you to sign in with your Docker account:

    ```bash id=host terminal-id=t2
    sbx mcp add dhi --url https://dhi.io/mcp
    ```

2. Check that it's registered and ready:

    ```bash id=host terminal-id=t2
    sbx mcp ls
    ```

3. From the `project` directory, create a dedicated sandbox named `mcp`, with the DHI server and the Trivy kit:

    ```bash id=host terminal-id=t2
    cd project
    ```

    ```bash id=host terminal-id=t2
    sbx create --name mcp --static-mcp dhi --kit ./kits/trivy copilot .
    ```

    `--static-mcp dhi` starts the sandbox's MCP gateway with **exactly this server**, and without the discovery tools an agent could use to find and add servers by itself. You decide which servers it gets. `--kit ./kits/trivy` adds the Trivy kit, which you'll use at the end of this module. The first time, `sbx` builds the kit's image, which downloads and checks Trivy.

    Check what the gateway was given:

    ```bash id=host terminal-id=t2
    sbx inspect mcp
    ```

    These lines describe this sandbox's gateway. `sbx mcp ls`, on the other hand, lists the servers registered on your host, whether or not a sandbox uses them.

4. Start an agent in the `mcp` sandbox:

    ```bash id=host terminal-id=t2
    sbx run --name mcp
    ```

    Then give it this prompt:

    ```prompt id=sandbox terminal-id=t2
    For both the frontend and the backend app, from their Dockerfiles, find the Alpine-based runtime Docker Hardened Image (not a -dev variant) that matches it and how many known CVEs it has. At the end, list the tools you called.
    ```

    The agent reads both Dockerfiles, calls `dhi` tools such as `dhi_get_repository` (Copilot lists them with the gateway's prefix, `mcp-gateway-dhi_get_repository`), and suggests the hardened Python 3.12 Alpine image for the backend and the hardened Node 22 Alpine image for the frontend, each with its CVE count. The prompt asks for Alpine even for the backend, whose `python:3.12-slim` is based on Debian: the Alpine hardened images are smaller and have fewer packages that can carry CVEs. In the real lab the exact tags it names vary from one run to the next: the images you scan below are `dhi.io/python:3.12-alpine` and `dhi.io/node:22-alpine`.

    > **Note:** most hardened images come in two variants. The **runtime** image is minimal: no shell, no package manager. The **`-dev`** variant adds them (pip, npm, a shell…) for building, and is meant for the build stage of a multi-stage Dockerfile. Because DevBoard's Dockerfiles install packages, an agent left to choose tends to pick the `-dev` variants, which is why the prompt asks for the runtime image. The difference shows in a scan of the Debian-based images: `dhi.io/python:3.12-debian13-dev` had 414 vulnerabilities in a test run, against 54 for `dhi.io/python:3.12`.

    > **Note:** the CVE counts the agent reports come from the DHI catalog's scan summary (read through the MCP server), so they won't match the Trivy numbers below, which come from scanning the images yourself with Trivy's database and the VEX statements. For example, the catalog reported 1 high CVE for `dhi.io/python:3.12-alpine` in a test run, while the Trivy scan below finds 0. Compare the hardened image with the original within one source, not across them.

    > **Important:** the DHI server also has tools that change things (creating and removing mirrors in your Docker organization). The prompt only asks the agent to look things up, and to list the tools it called: check that list.

5. Exit the session, then look at the sandbox's network activity:

    ```prompt id=sandbox terminal-id=t2
    /exit
    ```

    ```bash id=host terminal-id=t2
    sbx policy log mcp
    ```

    You'll find the Copilot and GitHub hosts, and the gateway itself (`mcp-gateway.docker.internal`, marked `<daemon-managed alias>`), but no request to the DHI server, and you didn't add any network rule: the agent only talks to the gateway, and the gateway reaches the MCP server from outside the sandbox.

> **Warning:** registering an MCP server is a trust decision. It runs outside the sandbox, with your host's permissions (local servers) or under the remote service's control, so the sandbox's network policy doesn't apply to it. Only register servers you trust.

## Scan the images before and after

Before switching DevBoard's Dockerfiles to the hardened images, measure what you'd gain. The Trivy kit you added to the `mcp` sandbox can scan the current base images and their DHI equivalents.

1. Scan the two current base images and the two hardened images the agent suggested, with the kit's `scan-images` helper:

    ```bash id=host terminal-id=t2
    sbx exec mcp scan-images python:3.12-slim dhi.io/python:3.12-alpine node:22-alpine dhi.io/node:22-alpine
    ```

    For each image, the helper runs `trivy image --image-src remote --scanners vuln --vex repo`: Trivy reads the image straight from its registry and applies the VEX statements, which mark the CVEs that don't affect the image. The first scan also downloads Trivy's vulnerability database, about 130 MB, and the VEX statements.

    The numbers change as new vulnerabilities are published, so yours will differ by a few in the real lab. Without the VEX statements, Trivy reports 226, 0, 25 and 0: it counts every published CVE that matches a package version, whether or not it affects the image.

2. See what the scanner reached:

    ```bash id=host terminal-id=t2
    sbx policy log mcp
    ```

    Each host the scanner reached is allowed either by your own rules or by the Trivy kit's rules:

    | Host in the log | What Trivy used it for | Allowed by |
    |-----------------|------------------------|------------|
    | `index.docker.io`, `auth.docker.io`, `production.cloudfront.docker.com` | Reading the Docker Hub images | Your rules, from *Network policies* |
    | `dhi.io` | Reading the hardened images | Your rules |
    | `mirror.gcr.io` | Downloading the vulnerability database | The kit's rules, for this sandbox only |
    | `raw.githubusercontent.com` | Downloading the VEX statements | The kit's rules, for this sandbox only |
    | `github.com`, `api.github.com`, `codeload.github.com` | Downloading the VEX statements | Both: the kit declares them, and your GitHub rules cover them too |

    One request is blocked: `check.trivy.dev`, Trivy's check for a newer version. Neither your rules nor the kit allow it, and the scan doesn't need it.

The scanner read the images, not your machine: it never had your Docker credentials, your `~/.ssh` folder or any host outside its rules. And because Trivy is now in the agent's sandbox, the agent can use it too: next time, you could ask it to scan the images it suggests. Check which variant it picked first: a `-dev` image scores far worse than its runtime image.
