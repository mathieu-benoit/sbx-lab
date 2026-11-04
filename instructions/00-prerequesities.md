# Prerequesities

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

    If it is not installed, follow [these instructions](https://docs.docker.com/ai/sandboxes/get-started/) to install or update `sbx`.

2. Ensure you are logged in by running the following command:

    ```bash
    sbx login
    ```

    If you need to login, complete the instructions on the screen to do so.

## Project setup

This lab is going to use some of the features of Git (namely worktrees). In order to do so, the project needs to be configured as a local git repo.

FIXME:
- fork
- clone

1. Initialize a repo in the current directory with `git init`:

    ```bash
    git init
    ```

2. Commit the starting project contents into the repo:

    ```bash
    git add .
    git commit -m "Initial commit"
    ```

You're all ready to go! Go ahead and move on to the next module!