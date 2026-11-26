# Docker Sandboxes with GitHub Copilot

Welcome! In this lab you use **GitHub Copilot** inside a [Docker Sandbox](https://docs.docker.com/ai/sandboxes/) to work on **DevBoard**, a small issue tracker (FastAPI + Next.js). Along the way you see how sandboxes keep your machine, your files and your credentials safe while an AI agent does real work.

This is the **simulated** version of the [hands-on lab](https://github.com/mathieu-benoit/sbx-lab): every command runs in your browser, scripted, so there is nothing to install and no Copilot usage allowance to spend. Use it to preview the lab before you take it, to revisit it afterwards, or to follow it without a Docker account.

**Duration:** about 60 minutes.

What you will learn, and how a sandbox works: see the [home page](../).

## How to use this lab

- **Run buttons.** Every command and prompt in these pages has a **Run** button: it types the block into a terminal and runs it. You can also type it yourself.
- **Four terminals.** The real lab uses several terminals on your laptop: one per agent, one to review and merge their work, one for the dashboard. They are the four tabs on the right, all on the same simulated machine. Use **Terminal 1** until the *Clone mode and parallel agents* module, which tells you when to switch.
- **Agent sessions.** `sbx run` opens an interactive agent session. The terminal prompt changes, and what you type is a prompt for the agent. Leave a session with `/exit` (in the real lab: **Ctrl-C twice**). Inside a session, start a line with `!` to run a shell command without leaving it, for example `!docker ps`.
- **Progress.** Each module lists milestones; they get checked off as you run the right command at the right moment.
- **Stuck?** The **Reset** button puts the simulated machine back to its starting state. Your progress is kept.

> **What is simulated:** the commands and outputs the modules ask you to run. The outputs are modelled on the real lab and abridged in places, so a real `sbx` may format a line differently. Anything else you type answers "this command isn't part of the lab".

Ready? Open **Prerequisites** in the menu.
