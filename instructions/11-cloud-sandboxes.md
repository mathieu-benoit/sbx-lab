# ☁️ Cloud sandboxes

Every sandbox so far ran on your machine. Add `--cloud` to the same `sbx` commands and the sandbox runs on **Docker's infrastructure** instead: a microVM with the same isolation, the same kits and the same agent, but no path back to your machine. Your agent keeps working when you close your laptop, and you can share what it serves through a public HTTPS URL.

> [!IMPORTANT]
> This module is **optional**. Cloud sandboxes need a [Docker Agentic Platform](https://docs.docker.com/agentic-platform/) subscription, and their compute is billed **pay as you go** while they run (a stopped sandbox isn't billed). The module uses one small sandbox (2 CPUs, 4 GiB) for under an hour, plus about 10 AI Credits for the Copilot prompt. Without a subscription, read it through, or try it in the [simulated lab](https://mathieu-benoit.github.io/sbx-lab/simspace/).

```mermaid
graph LR
    You(["You"])

    subgraph Host["Your machine"]
        direction TB
        Cli["sbx --cloud"]
        Backend["project/backend"]
    end

    subgraph Cloud["Docker's infrastructure"]
        direction TB
        Api["Cloud Sandboxes API"]
        Secrets["Cloud secret store<br/>github"]
        Policy["Cloud network policy<br/>account + sandbox rules"]
        subgraph Sandbox["Sandbox: devboard-cloud"]
            direction TB
            Agent["Copilot agent<br/>with Python from the kit"]
            Service["DevBoard API :8000"]
        end
        Url["Public HTTPS URL"]
    end

    Browser(["Anyone with the URL"])

    You --> Cli
    Cli -->|"create, attach, exec, stop, rm"| Api
    Api --> Sandbox
    Backend -->|"sbx --cloud cp, a one-time copy"| Agent
    Secrets -->|injected by the cloud proxy| Agent
    Policy -->|filters its traffic| Agent
    Browser --> Url
    Url -->|"sbx --cloud port publish"| Service

    %% Styles — containers
    style Host fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Cloud fill:#f5f7ff,stroke:#7d8fd8,color:#00084D
    style Sandbox fill:#f0faf4,stroke:#86c5a0,color:#00084D

    %% Styles — host nodes
    style Cli fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Backend fill:#fff,stroke:#0DB7ED,color:#384D54

    %% Styles — cloud nodes
    style Api fill:#fff,stroke:#7d8fd8,color:#384D54
    style Secrets fill:#fff,stroke:#7d8fd8,color:#384D54
    style Policy fill:#fff,stroke:#7d8fd8,color:#384D54
    style Url fill:#fff,stroke:#7d8fd8,color:#384D54

    %% Styles — sandbox nodes
    style Agent fill:#e0f2e6,stroke:#6db88a,color:#384D54
    style Service fill:#e0f2e6,stroke:#6db88a,color:#384D54

    %% Styles — actors
    style You fill:#fff,stroke:#1D63ED,color:#00084D
    style Browser fill:#fff,stroke:#1D63ED,color:#00084D
```

What changes from a local sandbox:

| | Local sandbox | Cloud sandbox |
|---|---|---|
| Runs on | Your machine | Docker's infrastructure, billed while running |
| Workspace | Your folder, mounted (or a private clone) | None: copy files in with `sbx --cloud cp`, or `git clone` inside |
| Secrets | `sbx secret` | A separate store: `sbx --cloud secret` |
| Network policy | Your local policy | A separate, network-only policy: account and sandbox rules |
| Ports | `localhost:<port>` on your machine | A public HTTPS URL |
| Lifetime | Until you remove it | A time-to-live (1 hour by default), then stopped or deleted |

Kits, `--kit-arg`, `sbx exec` and the agents themselves work the same way.

## Same CLI, separate sandboxes

1. Check that your account can use cloud sandboxes:

    ```bash id=host
    sbx --cloud diagnose
    ```

    The `CONNECTION` section should show `✓ Authentication — authenticated`, `✓ Cloud API — reachable` and `✓ Cloud entitlement — subscribed`.

2. List your cloud sandboxes:

    ```bash id=host
    sbx --cloud ls
    ```

    ```none id=host
    No sandboxes found
    ```

    `sbx ls` still lists `quickstart` and the others: `--cloud` switches the whole command to the cloud backend, with its own sandboxes, secrets, network policy and templates. Nothing you created locally appears there.

## Give the cloud a credential

Your local secrets stay in your OS keychain: the cloud can't use them. Store your GitHub token in the cloud secret store. It's kept there, outside the sandbox, and the cloud proxy adds it to the agent's requests, as your local proxy did:

```bash id=host
sbx --cloud secret set github
```

Paste your token when prompted: the output of `gh auth token`. Then check it:

```bash id=host
sbx --cloud secret ls
```

```none id=host
SCOPE      SERVICE   TYPE    SECRET   CREATED
(global)   github    token   ***      5s
```

That one secret is enough for Copilot: in the cloud, it covers both `GH_TOKEN` and `COPILOT_GITHUB_TOKEN`. `--command 'gh auth token'` isn't supported in the cloud, which stores the value itself.

## Network policy in the cloud

The cloud has its own policy: the Locked Down policy and the rules from the [network policies](01-network-policies.md) module stay on your machine. It has two scopes: your **account**, whose default your cloud sandboxes start from, and each **sandbox**.

1. Look at your account's policy:

    ```bash id=host
    sbx --cloud policy ls
    ```

    ```none id=host
      Default:  deny-all
    No allow or deny rules
    ```

    Yours may show another default, or rules, if you or your organization set them.

2. Set the account's default to `deny-all`, the cloud's equivalent of the Locked Down policy:

    ```bash id=host
    sbx --cloud policy init deny-all
    ```

    ```none id=host
      Default:  deny-all
    No allow or deny rules
    ```

    - The presets are `allow-all`, `balanced` (deny-all plus an allow list of common development services) and `deny-all`.
    - `init` keeps the existing allow and deny rules, and you can run it again to change the default. `sbx --cloud policy reset` removes the account's rules and goes back to the platform's default.
    - A `deny-all` default still lets through what a sandbox's own rules allow, including the rules its kits bring: that's how Copilot keeps working.

    > [!WARNING]
    > This changes the default for **all** the cloud sandboxes of your Docker account, not only this lab's. If you already use cloud sandboxes, check the output of the previous step first. Add `--sandbox <name>` to set the default of one sandbox only.

3. Your sandbox's own policy adds to this default: the rules its **kits** declare, and the ones you add for it, with `--allow-network` or `--deny-network` on `sbx --cloud create`, or later with `--sandbox <name>`. You'll check them once the sandbox exists.

## Create a cloud sandbox

1. From the `project` directory, create the sandbox with the same Copilot agent and Python kit as `quickstart`:

    ```bash id=host
    sbx --cloud create --name devboard-cloud --kit ./kits/python --ttl 1h --on-timeout stop copilot
    ```

    - There's **no `.`** at the end: a cloud sandbox has no workspace to mount, and passing a path is an error.
    - `--ttl 1h --on-timeout stop`: the sandbox stops after an hour unless you extend it. You'll come back to this below.
    - No `--cpus` or `--memory`: the default is 2 CPUs and 4 GiB, the `small` size. Sizes go from `micro` (1 CPU, 2 GiB) to `xl` (16 CPUs, 32 GiB).
    - On a Mac with Apple silicon, add `--platform linux/arm64`: moving the sandbox to your machine, later in this module, needs the same CPU architecture on both sides.

    The first time, it takes about 3 minutes: `sbx` builds the kit's image and uploads it as a cloud template. The output ends with:

    ```none id=host
    ✓ Created sandbox copilot/devboard-cloud (sbx_…, template tmpl_…)
    ```

    `sbx` may print `warning: kit credentials for github, copilot are not routed when launching an uploaded or imported kit image`. The cloud secret you stored still applies: you'll see it below.

2. Look at it:

    ```bash id=host
    sbx --cloud inspect devboard-cloud
    ```

    ```none id=host
    Name:         copilot/devboard-cloud
    Agent:        copilot
    State:        running (created 18s ago)
    CPUs:         2
    Memory:       4096 MiB
    On timeout:   stop
    Auto-resume:  enabled
    Ports:        none published
    Expires:      59m
    ```

3. Check what's inside, as you did for `quickstart`:

    ```bash id=host
    sbx --cloud exec devboard-cloud sh -c 'python3 -V; env | grep TOKEN; ls ~/workspace'
    ```

    ```none id=host
    Python 3.13.5
    GH_TOKEN=gho_sbxproxymanaged000000000000000000000
    COPILOT_GITHUB_TOKEN=proxy-managed
    ```

    Python came with the kit, the tokens are placeholders, and the workspace is **empty**: nothing from your machine is there.

### Check its network rules

4. List the sandbox's rules:

    ```bash id=host
    sbx --cloud policy ls devboard-cloud
    ```

    ```none id=host
      Default:  deny-all
    DECISION   NETWORK
    allow      api.business.githubcopilot.com:443
    allow      api.enterprise.githubcopilot.com:443
    allow      api.github.com:443
    allow      api.githubcopilot.com:443
    allow      api.individual.githubcopilot.com:443
    allow      copilot.github.com:443
    allow      release-assets.githubusercontent.com:443
    allow      deb.debian.org:80
    allow      dhi.io:80
    allow      pypi.org:443
    allow      files.pythonhosted.org:443
    ```

    You didn't add any of these: they come from the **kits**. The Copilot agent declares the hosts it needs, and the Python kit adds Debian and PyPI. The default, `deny-all`, blocks everything else.

5. Try a host that isn't on the list:

    ```bash id=host
    sbx --cloud exec devboard-cloud curl -sS -o /dev/null https://docker.com
    ```

    ```none id=host
    curl: (56) CONNECT tunnel failed, response 403
    ```

6. Allow it for this sandbox only, and try again:

    ```bash id=host
    sbx --cloud policy allow network docker.com:443 --sandbox devboard-cloud
    ```

    ```bash id=host
    sbx --cloud exec devboard-cloud curl -sS -o /dev/null -w "%{http_code}\n" https://docker.com
    ```

    This time you get `301`, a redirect from docker.com. Remove the rule:

    ```bash id=host
    sbx --cloud policy rm network --sandbox devboard-cloud --resource docker.com:443 --force
    ```

    > [!NOTE]
    > `sbx --cloud policy allow network <host>` without `--sandbox` changes your **account** policy, which applies to all your cloud sandboxes. Prefer `--sandbox`, or `--allow-network` on `sbx --cloud create`. The cloud policy is network-only: HTTP method and path rules aren't supported.

## Bring the code and put the agent to work

1. Copy the backend into the sandbox:

    ```bash id=host
    sbx --cloud cp ./backend devboard-cloud:/home/agent/workspace/backend
    ```

    ```none id=host
    Uploaded 79 files from ./backend
    ```

    It's a **one-time copy**, not a mount: what the agent changes stays in the sandbox until you copy it back, and what you change on your machine doesn't reach it. For a repository, you can also `git clone` it inside the sandbox.

2. Open a session with the agent:

    ```bash id=host
    sbx --cloud attach devboard-cloud
    ```

3. Give it the following prompt:

    ```console id=sandbox
    Create a Python virtual environment in ~/venv, install backend/requirements.txt, and run the backend tests with pytest.
    Then start the API in the background, listening on 0.0.0.0:8000, with DATABASE_URL=sqlite:///./devboard.db,
    and check that its /docs page answers on port 8000.
    ```

    The agent installs the packages from PyPI, through the kit's rules, and runs the tests in about half a minute. The results are the same as on your machine, since the code is the one you merged. SQLite stands in for the PostgreSQL that Docker Compose started in the [Docker module](08-docker-inside-the-sandbox.md).

4. Leave the session **without stopping it**: press **`Ctrl+\`**. You're back on your host, and the agent keeps running in the cloud, even if you close your laptop. `sbx --cloud attach devboard-cloud` joins the same session again.

## Share the app with a public URL

1. Publish the API's port:

    ```bash id=host
    sbx --cloud port publish devboard-cloud 8000
    ```

    ```none id=host
    Port 8000 exposed at https://8000-<sandbox-id>.sbx.sandboxes-cloud.docker.com
    ```

    In the cloud, you name the sandbox port only: no host port, since there's no host. The URL is **public**: anyone who has it reaches the service, without signing in.

2. Open the URL with `/docs` at the end: the DevBoard Swagger UI, served from the cloud sandbox. Send it to a colleague: it works from any browser.

3. List the published ports:

    ```bash id=host
    sbx --cloud port ls devboard-cloud
    ```

    ```none id=host
    PORT   URL
    8000   https://8000-<sandbox-id>.sbx.sandboxes-cloud.docker.com
    ```

> [!WARNING]
> Treat a published URL as a public endpoint: DevBoard's API lets anyone register. Protect the service itself, and unpublish the port when you no longer need it (you will, at the end of this module).

## Move a sandbox between your machine and the cloud

`sbx move` takes a snapshot of a sandbox's filesystem, carries it across, and creates a new sandbox from it on the other side: `--to local` brings a cloud sandbox to your machine, and `--to cloud` sends a local one to the cloud. The command spans both sides, so it takes no `--cloud` flag. The source isn't deleted, and the two sandboxes don't sync afterwards.

| Travels | Doesn't travel |
|---|---|
| The sandbox's files: the code you copied in, `~/venv`, what the agent installed | Running processes and memory: the API doesn't run on the other side until you start it |
| The kit's network rules, to the cloud | Rules you added yourself: the destination's own policy applies |
| Published ports: a new URL in the cloud, a `127.0.0.1` port locally | Secrets: the destination uses its own secret store |
| Credentials an agent saved in files | Your local workspace folder: it's mounted, not part of the sandbox |

1. Bring the cloud sandbox to your machine:

    ```bash id=host
    sbx move devboard-cloud --to local --name devboard-local
    ```

    `sbx` lists what doesn't carry over, and asks you to confirm (`--force` skips the question). It then downloads the snapshot, in about 2 to 3 minutes, and ends with:

    ```none id=host
      ✓ port 8000/tcp — published 127.0.0.1:60000

      ✓ Created sandbox devboard-local
        Stopping cloud sandbox sbx_… ...
        Stop accepted for cloud source sandbox sbx_…; the stop continues in the background. Check it with `sbx --cloud ls`.
    Moved to local sandbox devboard-local
      Files:        inside the sandbox at the image's working directory (no local folder is mounted)
      Attach with:  sbx run --name devboard-local
    ```

    Note the stop: once the copy is made, the move **stops the cloud sandbox**, so you don't pay for two.

    > [!NOTE]
    > The snapshot keeps the sandbox's CPU architecture, and your machine must run the same one: `sbx move` checks it before transferring anything. Our cloud sandbox was `linux/amd64`. On a Mac with Apple silicon, create the cloud sandbox with `--platform linux/arm64` for this step.

2. Look inside the local copy:

    ```bash id=host
    sbx exec devboard-local sh -c 'ls ~/workspace/backend; ~/venv/bin/python -c "import fastapi; print(fastapi.__version__)"; env | grep _TOKEN'
    ```

    ```none id=host
    Dockerfile
    app
    pytest.ini
    requirements.txt
    tests
    0.162.4
    GH_TOKEN=proxy-managed
    COPILOT_GITHUB_TOKEN=proxy-managed
    ```

    - **The work came with it:** the backend and the virtual environment the agent created in the cloud.
    - **The tokens are placeholders again**, now filled in by your **local** secrets, from the [Secrets and credentials](03-secrets-credentials.md) module.
    - **There's no workspace folder:** the files stay inside the sandbox (`sbx ls` shows `-` as its workspace). Copy them out with `sbx cp`.
    - **Port 8000 was kept**, on a `127.0.0.1` port that `sbx` picked (`sbx port ls devboard-local`), but nothing listens on it: the API process stayed behind. Your local network policy applies, not the cloud's.

3. Remove the local copy:

    ```bash id=host
    sbx rm --force devboard-local
    ```

4. The other direction hands a local sandbox over to the cloud, for example a long task you want to keep running when you close your laptop. Don't run it now:

    ```bash id=host no-run-button
    sbx move quickstart --to cloud --name quickstart-cloud --ttl 1h --on-timeout stop
    ```

    - The move **stops the local sandbox** while it captures its filesystem.
    - Your **workspace folder isn't copied**: `sbx` warns and asks first. Only what's inside the sandbox travels.
    - The kit's network rules are applied in the cloud, but not the rules you added locally.
    - CPU and memory are rounded up to a cloud size, and published ports get new public URLs.
    - `--ttl` and `--on-timeout` work as they do on `sbx --cloud create`.
    - The move leaves a cloud **template** behind, and its output names it: remove it with `sbx --cloud template rm` once you've removed the sandbox.

## Expiry, stop and resume

1. The move stopped `devboard-cloud`. Check it:

    ```bash id=host
    sbx --cloud ls
    ```

    It shows `○ stopped`. A stopped sandbox keeps its memory and its files, and **isn't billed**. To stop one yourself, when you take a break, run `sbx --cloud stop <name>`.

2. Open the public URL again, with `/docs`. The page loads after a second or two: the request **woke the sandbox up** (that's `Auto-resume: enabled` in `inspect`). The API is still running: its process was kept with the sandbox's memory, so nothing had to start again. `sbx --cloud ls` shows it `● running` again.

    `sbx --cloud attach devboard-cloud` resumes a stopped sandbox the same way, and connects you to its agent.

3. Check how long the sandbox has left, and give it 30 more minutes:

    ```bash id=host
    sbx --cloud ttl devboard-cloud
    ```

    ```bash id=host
    sbx --cloud ttl +30m devboard-cloud
    ```

    ```none id=host
    Extended TTL
    Expires in 1h29m (MAX remaining: 23h58m).
    ```

    Resuming started a new hour. A sandbox can live at most 24 hours from its creation. When its time runs out, `--on-timeout` decides what happens: `stop` (as here), `restart`, or `delete`.

## Get the result and clean up

1. Have the sandbox write a test report, and copy it to your machine:

    ```bash id=host
    sbx --cloud exec devboard-cloud sh -c 'cd ~/workspace/backend && ~/venv/bin/pytest -q | tail -1 > test-report.txt'
    ```

    ```bash id=host
    sbx --cloud cp devboard-cloud:/home/agent/workspace/backend/test-report.txt ./test-report.txt
    ```

    `cat test-report.txt` shows the last line of the pytest run. For code changes, copy the files back the same way, or have the agent push a branch to GitHub.

2. Unpublish the port:

    ```bash id=host
    sbx --cloud port unpublish devboard-cloud 8000
    ```

3. Remove the sandbox. This stops the billing for good, and deletes everything in it:

    ```bash id=host
    sbx --cloud rm devboard-cloud
    ```

    `sbx --cloud ls` shows `No sandboxes found` again. Remove `test-report.txt` from the `project` folder too.

4. If you don't use cloud sandboxes for other work, remove the cloud secret:

    ```bash id=host
    sbx --cloud secret rm github
    ```

## Going further

- **Templates:** `sbx --cloud template save` captures a configured sandbox, and `sbx --cloud create --template` starts new ones from it in seconds.
- **Schedules:** `sbx --cloud schedule` runs an agent on a cron schedule, unattended.
- **SSH:** `sbx --cloud setup ssh` lets your SSH client and editor connect to a cloud sandbox.
- **Volumes** (experimental): `sbx --cloud volume` keeps data, such as a dependency cache, across sandboxes.
- **Environment files:** `sbx --cloud env` creates cloud sandboxes from an `sbxenv.yaml` file.
- **Docker inside a cloud sandbox:** it works, with one known limit: `docker exec`, `docker compose exec` and healthchecks can run in the sandbox's filesystem instead of the container's, which can block services that wait on `service_healthy`. See [Known limitations](https://docs.docker.com/ai/sandboxes/cloud/usage/#known-limitations).

See the [cloud sandboxes documentation](https://docs.docker.com/ai/sandboxes/cloud/) for the rest.

> [!TIP]
> Cloud sandboxes also have a **web interface**: [Docker Agentic Platform](https://agentic-platform.docker.com/). Sign in with your Docker account to see your sandboxes, and to manage kits, MCP servers, secrets and policies from your browser. Its secrets are a separate store: a secret set there isn't available to `sbx --cloud secret`, and the other way around.

[[<< Previous: MCP servers](10-mcp-servers.md) | [Next >> Wrap up](12-wrap-up.md)]
