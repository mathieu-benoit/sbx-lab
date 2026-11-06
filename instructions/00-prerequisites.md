# Prerequisites

This lab will walk you through many of the features and capabilities of Docker Sandboxes.

> [!WARNING]
> The commands in this lab are written to use the `sbx` CLI directly on your host machine (MacOS, Windows or Linux environments).

## sbx setup

Every exercise depends on `sbx` running correctly on your host machine. **Do not skip this section.**

1. Verify sbx is installed by running the following command:

    ```bash
    sbx version
    ```

    Expected output: a version string like `sbx v0..0` or similar.

    If it is not installed, follow [these instructions](https://docs.docker.com/ai/sandboxes/install/) to install or update `sbx`.

2. Ensure you are logged in by running the following command:

    ```bash
    sbx login
    ```

    If you need to login, complete the instructions on the screen to do so.

3. This lab assume that your Docker username doesn't belong to an Organization that may have already AI Governance policies in place, check that this list is empty:

    ```bash
    sbx policy ls
    ```

You're all ready to go! Go ahead and move on to the next module!

[[Next >> Credentials]](01-secrets-credentials.md)
