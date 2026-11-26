# Port forwarding with `sbx port`

Sandboxes are network-isolated: your browser can't reach a server running inside one by default. `sbx port publish` publishes a sandbox port on a host port.

```mermaid
graph LR
    You(["You, in your browser"])

    subgraph Host["Your machine"]
        direction TB
        Port3001["localhost:3001"]
        Port8000["localhost:8000"]
    end

    subgraph Sandbox["Sandbox: quickstart"]
        direction TB
        Frontend["frontend :3000"]
        Backend["backend :8000"]
    end

    You -->|opens the app| Port3001
    You -->|API calls from the page| Port8000
    Port3001 -->|"sbx port publish 3001:3000"| Frontend
    Port8000 -->|"sbx port publish 8000:8000"| Backend

    style Host fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Sandbox fill:#f0faf4,stroke:#86c5a0,color:#00084D
    style Port3001 fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Port8000 fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Frontend fill:#e0f2e6,stroke:#6db88a,color:#384D54
    style Backend fill:#e0f2e6,stroke:#6db88a,color:#384D54
    style You fill:#fff,stroke:#1D63ED,color:#00084D
```

> **In this simulation** your browser is `curl`: the lab can't open `localhost` pages, so you request them from the terminal. In the real lab you open them in your browser and click through the DevBoard app.

Use **Terminal 2**: the agent session from the previous module stays open in Terminal 1.

## Forward the API

1. With the Docker Compose stack from the previous module still running (the `quickstart` sandbox must be running: see `sbx ls`), publish the API port:

    ```bash id=host terminal-id=t2
    sbx port publish quickstart 8000:8000
    ```

2. Request the API's health endpoint, served from inside the sandbox. In the real lab you open [http://localhost:8000/docs](http://localhost:8000/docs) to see the live Swagger UI:

    ```bash id=host terminal-id=t2
    curl http://localhost:8000/health
    ```

## Forward the frontend

1. Publish the sandbox's port 3000 on port 3001 of your host to reach the frontend. The syntax is `HOST_PORT:SANDBOX_PORT`; 3001 is used here to show that the two ports don't have to match:

    ```bash id=host terminal-id=t2
    sbx port publish quickstart 3001:3000
    ```

2. Request the DevBoard web front end. In the real lab you open [http://localhost:3001](http://localhost:3001), click **Register** to create an account, then create a project and a few issues:

    ```bash id=host terminal-id=t2
    curl http://localhost:3001
    ```

> **Note:** the browser calls the API directly at `http://localhost:8000`, which is why the API port must be published on the same port number, and why the API accepts requests from `http://localhost:3001`.

## Additional commands

To list the ports published by a sandbox, run `sbx port ls` with the sandbox name:

```bash id=host terminal-id=t2
sbx port ls quickstart
```

To stop publishing a port, use `sbx port unpublish`. With `HOST_PORT:SANDBOX_PORT` it removes that one mapping; with only the sandbox port, every host port mapped to it. You don't need to run this one now:

```bash id=host no-run-button
sbx port unpublish quickstart 8000:8000
```

> **Important:** services inside the sandbox must listen on `0.0.0.0`, not `127.0.0.1`. Many development servers default to `127.0.0.1`, which is why the prompt in the previous module explicitly asks the agent to bind to `0.0.0.0`.

> **Important:** ports are only reachable while the sandbox is running. A sandbox stops when no agent session is attached, so keep your agent session open, or start it without a session with `sbx run --detach --name quickstart`. Published ports are restored when the sandbox restarts: while it is stopped, `sbx port ls quickstart` shows `No published ports`, and the list comes back once it runs again.

## Publish a port from a kit

`sbx port publish` publishes a port after the sandbox exists. A **kit** can declare the ports its sandbox serves instead, with the `com.docker.sandbox/port@1` capability: the port is then published as soon as the sandbox is created, for everyone who uses the kit. The project includes a small mixin for the API's port:

:filelink[project/kits/api-port/api-port.yaml]{path="project/kits/api-port/api-port.yaml"}

There's one difference with `sbx port publish`: a kit only names the **sandbox** port. The **host** port is chosen by `sbx`, a free one on `127.0.0.1`, and chosen again each time the sandbox starts. That's on purpose: a kit is shared, and two kits asking for the same host port would collide. When the host port matters, as for DevBoard's API, which the browser calls at `localhost:8000`, you still pin it yourself with `sbx port publish`.

```mermaid
graph LR
    You(["You, in your browser"])

    subgraph Host["Your machine"]
        direction TB
        Pinned["localhost:8000<br/>you choose it"]
        Ephemeral["127.0.0.1:random port<br/>sbx chooses it"]
    end

    subgraph Sandbox["Sandbox"]
        direction TB
        Service["service on :8000"]
    end

    Kit["Kit: port@1, container 8000"]

    You -->|opens| Ephemeral
    Kit -->|"published at sbx create"| Ephemeral
    Ephemeral -->|forwards to| Service
    Pinned -->|"sbx port publish 8000:8000"| Service

    style Host fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Sandbox fill:#f0faf4,stroke:#86c5a0,color:#00084D
    style Pinned fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Ephemeral fill:#E5F2FC,stroke:#1D63ED,color:#00084D
    style Kit fill:#fff,stroke:#0DB7ED,color:#384D54
    style Service fill:#e0f2e6,stroke:#6db88a,color:#384D54
    style You fill:#fff,stroke:#1D63ED,color:#00084D
```

Try it in a separate sandbox, from the `project` directory, in **Terminal 2**:

1. Go to the `project` directory (you're already there if you followed the previous modules), then create a sandbox with the DevBoard kit and the port kit:

    ```bash id=host terminal-id=t2
    cd project
    ```

    ```bash id=host terminal-id=t2
    sbx create --name ports-demo --kit ./kits/devboard --kit ./kits/api-port copilot .
    ```

2. Keep it running without an agent session. No agent is attached to this sandbox, so without this step it stops shortly after the `sbx exec` below, and the web server with it:

    ```bash id=host terminal-id=t2
    sbx run --detach --name ports-demo
    ```

3. List its ports. You haven't published anything, yet port 8000 is already there, on a host port that `sbx` picked:

    ```bash id=host terminal-id=t2
    sbx port ls ports-demo
    ```

    `sbx` picks the host port again each time the sandbox starts, so list the ports after the sandbox is running.

4. Start a small web server on port 8000 in the sandbox. It serves the project folder:

    ```bash id=host terminal-id=t2
    sbx exec ports-demo sh -c 'nohup python3 -m http.server 8000 >/dev/null 2>&1 &'
    ```

5. Request `http://127.0.0.1:<HOST PORT>/`, with the host port from step 3: you see the files of the `project` folder, served from inside the sandbox.

    ```bash id=host terminal-id=t2
    curl http://127.0.0.1:60000/
    ```

6. Remove the sandbox:

    ```bash id=host terminal-id=t2
    sbx rm --force ports-demo
    ```
