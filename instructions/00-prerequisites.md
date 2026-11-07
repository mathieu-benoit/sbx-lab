# 📝 Prerequisites

## Accounts and platform

- A computer running macOS, Windows, or Linux.
- A Docker account. Docker Sandboxes are free to use; [create a Docker account](https://hub.docker.com/signup) if you don't have one.
- A GitHub account and access to GitHub Copilot. [Create a GitHub account](https://github.com/signup) and check the [Copilot plans](https://github.com/features/copilot/plans) for available options.
- The `sbx` CLI installed on your computer; follow [these instructions](https://docs.docker.com/ai/sandboxes/install/) to install or update `sbx`.

## sbx setup

Every exercise depends on `sbx` running correctly on your host machine. **Do not skip this section.**

1. Verify sbx is installed by running the following command:

    ```bash
    sbx version
    ```

    Expected output: a version string like `sbx version v0..0` or similar.

2. Ensure you are logged in by running the following command:

    ```bash
    sbx login
    ```

    If you need to login, complete the instructions on the screen to do so.

3. This lab assumes your Docker account is not subject to organization AI Governance policies. Check the configured policies:

    ```bash
    sbx policy ls
    ```
  
    You should see this:

    ```none
      POLICY             SOURCE   APPLIES TO   SUMMARY
      default-deny-all   local    all          network: deny when no rule decides
      local-policy       local    all          network: 20 allow; filesystem read: 1 allow; filesystem write: 1 allow
    ```
      POLICY             SOURCE   APPLIES TO   SUMMARY
      default-deny-all   local    all          network: deny when no rule decides
      local-policy       local    all          filesystem read: 1 allow; filesystem write: 1 allow

    If your organization has policies that restrict this lab, use a personal Docker account or ask your administrator for guidance.

You're all ready to go! Go ahead and move on to the next module!

[[Next >> Network policies](01-network-policies.md)]
