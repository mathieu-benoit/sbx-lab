# Clone mode and parallel agents

## Direct mode vs. clone mode

Everything in the previous section ran in **direct mode** — your agent edited your working tree and you could see the changes immediately. That's great for interactive work.

**Clone mode** gives your agent a private Git clone inside the sandbox, isolated from your main working tree. You keep working normally; the agent works in its own clone; you fetch the changes and review the diff before merging. Use it when you want a clean diff to review before anything lands, or when running multiple agents simultaneously.

### Single clone: working in isolation

1. If you are currently in the sandbox **press `ctrl-c` twice to exit**.

2. Start a new agent session in clone mode by adding the `--clone` flag, and give it a name so you know which Git remote to fetch from later:

    ```bash
    sbx run claude --clone --name=fix-bugs
    ```

    The agent works inside a private Git clone. Your working tree is mounted read-only — the agent can read your code but cannot modify your files directly.

3. Give your agent the following prompt to fix the last broken test:

    ```console
    One test is still failing after the direct-mode fix. The updated_at field in backend/app/models.py never changes on update. Fix the bug and commit with a descriptive message.
    ```

4. Once the agent finishes, retrieve its work from a second terminal by fetching from the sandbox remote:

    ```bash terminal-id=host
    git fetch sandbox-fix-bugs
    git log HEAD..FETCH_HEAD --oneline
    ```

    The sandbox exposes its clone as a Git remote named `sandbox-<name>`. Review the commits, then
    merge or cherry-pick as you normally would.

### Parallel agents

Because each clone-mode sandbox has its own private Git clone, you can run multiple agents simultaneously with no conflicts. The key is giving each sandbox a distinct `--name` and passing each agent its task up front via a prompt file — this lets both fire off without any interactive back-and-forth.

DevBoard has two unimplemented features that make ideal parallel tasks:

- **Search** — `GET /issues/search?q=` returns 501; the query logic needs to be written
- **Notifications** — `send_status_change_notification()` is a no-op stub; it needs to actually send emails on issue status changes

The `prompts/` directory in this repo includes a ready-made prompt file for each.

1. Start one agent in a new terminal, giving it the prompt to implement search (the specification is provided in the `prompts` directory):

    ```bash terminal-id=parallel-agent-1
    sbx run claude --clone --name=add-search -- --allow-dangerously-skip-permissions "$(cat prompts/implement-search.txt)"
    ```

    > **Note**: the `"$(cat ...)"` must be quoted or the prompt won't be passed correctly
    > to the sandbox.

2. Launch a second agent in another terminal to implement notifications, giving it its specification:

    ```bash terminal-id=parallel-agent-2
    sbx run claude --clone --name=add-notif -- --allow-dangerously-skip-permissions "$(cat prompts/implement-notifications.txt)"
    ```

Each sandbox gets its own isolated Git clone, so they read and write completely separate copies of the code with no conflicts. You'll see both sandboxes in `sbx ls`.

Each agent reads its prompt and gets to work independently. You can watch each agent's progress in its own terminal. When they finish, retrieve each agent's work:

```bash terminal-id=host
git fetch sandbox-add-search
git fetch sandbox-add-notif
```

### Reviewing and merging agent work

After fetching, each agent's commits are available as remote-tracking branches — the same model as working with `origin`. The branch name is `sandbox-<name>/<branch>`, where `<branch>` is whatever was checked out when the sandbox was created (typically `main`).

1. Inspect what each agent committed before merging anything:

    ```bash terminal-id=host
    git log HEAD..sandbox-add-search/main --oneline
    ```
    And the notification task:

    ```bash terminal-id=host
    git log HEAD..sandbox-add-notif/main --oneline
    ```

2. Merge each agent's branch into your working branch:

    ```bash terminal-id=host
    git merge sandbox-add-search/main
    git merge sandbox-add-notif/main
    ```

    If both agents touched the same files you may get a merge conflict — resolve it as you would
    any other merge, then `git merge --continue`.

    > **Tip**: Prefer reviewing one agent's diff before merging the second. Running
    > `git diff sandbox-add-search/main` shows exactly what will change before you commit to it.