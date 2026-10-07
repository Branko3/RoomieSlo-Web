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
status table; do not pass a feature request on the command line. A feature row
whose notes begin with `Deferred: Yes` remains in the backlog but is skipped
until that marker is removed.

The runner denies permission requests unless `COPILOT_AUTO_APPROVE=true` is set.
Set that variable only after reviewing the repository and the prompts passed to
the agents. This is required because the SDK runner has no interactive VS Code
permission UI. Never use unattended approval for a repository you do not trust.

## Automated Git publishing

Before starting each feature, the runner requires a clean working tree and
creates a new branch named `agent/<feature-slug>`. After the developer and
testing agents complete successfully, it commits all feature changes and
pushes that branch to the `origin` remote. The runner stops instead of
creating a partial commit when either agent fails or the working tree is
unexpectedly clean.

After pushing, the runner opens a non-draft pull request from the feature
branch into `main`. It requires the GitHub CLI to be installed, authenticated,
and available to the Node process.

The machine running the workflow must have Git installed, `origin` configured,
and authenticated push access to the repository. For GitHub, configure the
credential helper once with:

```powershell
gh auth setup-git
```

If PowerShell can run Git but the workflow reports that Git could not be
started, provide the full executable path in the workflow's PowerShell session:

```powershell
$env:GIT_EXECUTABLE = "C:\Program Files\Git\cmd\git.exe"
```

If the workflow cannot find the GitHub CLI, provide its full executable path:

```powershell
$env:GH_EXECUTABLE = "C:\Program Files\GitHub CLI\gh.exe"
```

Set `COPILOT_AUTO_PUSH=false` to keep the feature commit local while testing
the workflow. Automatic pushing is enabled by default when the variable is
unset.
