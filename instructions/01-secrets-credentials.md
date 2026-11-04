# 🔑 Secrets and credentials

`sbx` has a built-in secrets manager that stores credentials in your OS keychain — never in plain text on disk or inside the VM. When your agent makes an outbound request that needs authentication, the host-side proxy intercepts it and injects the credential automatically. Claude can make authenticated API calls but can never read, log, or exfiltrate the raw credential.

1. Store your GitHub token **now**, before creating a sandbox. The `-g` flag makes it global — available to all sandboxes you create:

    ```bash
    echo "$(gh auth token)" | sbx secret set -g github
    echo "$(gh auth token)" | sbx secret set -g copilot
    ```

    > [!IMPORTANT]
    > Global secrets must be set before a sandbox is created. They are injected at creation time and cannot be added retroactively to a running sandbox. Sandbox-scoped secrets (without `-g`) can be added at any time and override the global value for that sandbox.

2. Ensure the credential was added with the `sbx secret ls` command:

    ```bash
    sbx secret ls
    ```

    You should see something like: 

    ```
    SCOPE      SERVICE   SECRET
    (global)   github    gho_TK421****...****R2D2
    (global)   copilot   gho_TK421****...****R2D2
    ```
