# RoomieSlo agent orchestration

This runner reads the ordered feature checklist from
`docs/web-feature-status.md` and automatically passes the next incomplete
feature from the product manager to the developer and then to the testing
agent. It uses the Copilot SDK to create separate sessions in the RoomieSlo
project directory.

## Prerequisites

- Node.js 20.19 or newer.
- GitHub Copilot CLI/runtime available to the SDK.
- An authenticated Copilot environment with permission to edit this project.
- On Windows, the workflow uses the installed `@github/copilot-win32-x64`
  executable automatically.

## Install and run

From this directory:

```powershell
npm install
.\node_modules\@github\copilot-win32-x64\copilot.exe login
$env:COPILOT_AUTO_APPROVE = "true"
npm run workflow
```

The login command opens the GitHub OAuth flow and stores the credential in the
local Copilot credential store. Run it once per machine before starting the
orchestrator. In headless environments, use
`copilot.exe login --device-code` instead.

`COPILOT_AUTO_APPROVE=true` passes the Copilot CLI `--allow-all` flag so the
SDK runner can work without an interactive VS Code permission dialog. Use it
only for a repository and prompts you trust.

One invocation starts the complete delivery loop. The runner processes features
in document order, selecting the first row whose `Backlog` value is `Yes` or
`Partial` and whose `Implemented` value is not `Yes`. After each successful
product-manager → developer → testing handoff, it automatically selects the
next incomplete feature. It stops when no incomplete feature remains or when a
feature fails its handoff, so an incomplete feature cannot be silently skipped.

The runner loads the role instructions from `.github/agents/`, so those files
remain the source of truth. It stops if the developer does not report a feature
record or if the record cannot be read. Feature selection is controlled by the
status table; do not pass a feature request on the command line.

The runner denies permission requests unless `COPILOT_AUTO_APPROVE=true` is set.
Set that variable only after reviewing the repository and the prompts passed to
the agents. This is required because the SDK runner has no interactive VS Code
permission UI. Never use unattended approval for a repository you do not trust.
