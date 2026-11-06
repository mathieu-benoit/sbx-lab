# 📦 Creating your first sandbox

The `sbx create` command provisions a sandbox without attaching to it — useful when you want to set it up, verify it appears in `sbx ls`, or script multiple sandboxes before starting any of them. `sbx run` then attaches an agent session to an existing sandbox (or creates one on the fly if it doesn't exist yet).

## Starting the sandbox

1. From the root of the cloned repository, switch to the sample application directory:

    ```bash
    cd project
    ```

2. Create your first sandbox by using the `sbx create` command:

    ```bash
    sbx create --name quickstart copilot .
    ```

3. Confirm it was created by listing all sandboxes:

    ```bash
    sbx ls
    ```

4. With the sandbox created, start a new agent in it and attach to it:

    ```bash
    sbx run quickstart
    ```

    Docker Sandboxes starts Copilot with `--yolo` by default and trusts the workspace directory. This lets Copilot work in the project without repeated permission confirmations; you do not need to add the flag yourself.

    > [!IMPORTANT]
    > `--yolo` allows Copilot to run tools without individual confirmations. The sandbox limits the environment, but you should still review the agent's actions and changes.

5. Ask the agent to tell you about the project:

    ```console
    Explore this codebase and give me:
    1. A summary of the architecture and tech stack
    2. How to run it locally (without Docker Compose if possible)
    3. Any obvious issues or areas of concern you spot at a glance
    4. What the test suite covers
    ```

    Your agent will read the source files, check the requirements, and report back. Because the workspace is mounted directly into the VM, your agent sees your actual files — including any changes you make on the host while it's running.

### Controlling the session

`sbx run` is interactive — it occupies your terminal as a live agent session.

- Press **`Ctrl-C` twice** to exit the session and drop back to your host terminal. 
- Type **`!`** before any command inside your agent to run it as a shell command without leaving the session — e.g. `!ls` or `!git status`.

Go ahead and exit the sandbox by **pressing `ctrl-c` twice** 

[[Secrets and credentials << Previous](02-secrets-credentials.md) | [Next >> TUI dashboard](04-tui-dashboard.md)]
