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
`Partial` and whose `Implemented` value is not `Yes`. For each feature it runs:

1. **Product manager (planning)** writes the developer handoff.
2. **Developer** implements the feature and its `docs/features/<slug>.md` record.
3. **Testing** writes and runs automated tests and fills in the record's
   `Test status` section.
4. **Product manager (review)** returns `VERDICT: APPROVED` or
   `VERDICT: CHANGES_REQUESTED` (or `VERDICT: BLOCKED`, see below) with an
   `ASSIGNEE` and `FEEDBACK`.

A feature is ready only when the review approves it **and** the record's
`Automated status` is `Covered`. Otherwise the feedback goes back to the
assigned agent (developer fixes are followed by another testing round) and the
review repeats, up to `COPILOT_MAX_FIX_ATTEMPTS` extra rounds (default `2`).
A feature that is still not approved after that is published as a draft pull
request so it cannot be merged by mistake. The runner then continues with the
next feature, and stops on any agent, Git, or GitHub error.

The review can also return `VERDICT: BLOCKED` when the only remaining gaps
need resources the agents cannot obtain, such as staging credentials or
browsers that are not installed. The feature is then published as a draft
immediately instead of spending fix rounds on work that cannot succeed. The
developer and testing prompts also tell agents not to start long-running
servers, install browsers, or attempt staging-only scenarios.

Each agent call has a time limit of `COPILOT_AGENT_TIMEOUT_MINUTES` (default
`30`). When it is reached, the agent session is aborted. If the agents have
already changed the repository, the work so far is published as a draft pull
request and the runner continues with the next feature. If a run fails before
any change was made, the runner deletes the empty feature branch so the next
run can restart that feature; otherwise it leaves the branch checked out for
inspection.

The runner loads the role instructions from `.github/agents/`, so those files
remain the source of truth. The feature record is identified from the records
changed on the feature branch (preferring the path the developer reports), so an
older record is never mistaken for the new one. The runner stops if no record
can be identified. Feature selection is controlled by the
status table; do not pass a feature request on the command line. A feature row
whose notes begin with `Deferred: Yes` remains in the backlog but is skipped
until that marker is removed.

The runner denies permission requests unless `COPILOT_AUTO_APPROVE=true` is set.
Set that variable only after reviewing the repository and the prompts passed to
the agents. This is required because the SDK runner has no interactive VS Code
permission UI. Never use unattended approval for a repository you do not trust.

Because the agent files are injected as system text, their `tools` frontmatter
is not a runtime boundary. The runner enforces permissions per role instead:

| Role            | Allowed permission kinds |
| --------------- | ------------------------ |
| product-manager | read                     |
| developer       | read, write, shell, url  |
| testing         | read, write, shell       |

Shell commands that invoke `git` or `gh` are always denied, because the runner
owns all Git and GitHub operations.

## Automated Git publishing

Before starting each feature, the runner requires a clean working tree,
switches to `main`, fast-forwards it to `origin/main`, and creates a new
branch named `agent/<feature-slug>`. Every feature branch therefore starts from
`main`, and each pull request contains only its own feature. A feature that
depends on another unmerged feature must wait for that pull request to be
merged; the product manager is asked to call out such dependencies.

After the delivery loop finishes, the runner stages all changes, refuses to
commit generated or secret paths (`.env*`, `node_modules/`, `.next/`,
`test-results/`, `playwright-report/`, `*.tsbuildinfo`, and similar), commits,
pushes the branch to `origin`, and switches back to `main`. The runner stops
instead of creating a partial commit when an agent fails or the working tree is
unexpectedly clean.

After pushing, the runner opens a pull request from the feature branch into
`main`: a normal pull request for approved, fully covered features, and a draft
for blocked or unverified ones. The body records the feature-record path, the
automated test status, and the final product-manager review. It requires the GitHub CLI to be installed, authenticated,
and available to the Node process.

When resuming, the runner checks GitHub for an existing pull request for the
feature branch. Open or already merged pull requests are reported and skipped,
so existing work is not overwritten. A branch without a pull request still
stops the workflow for manual review.

If the developer creates a feature record with `Status: Blocked` (initially or
during a fix round), the runner does not start the testing handoff. It preserves the blocker, commits and
pushes the branch, and opens a draft pull request so the incomplete work is
visible without being presented as ready to merge.

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
the workflow. The runner still commits on the feature branch and switches back
to `main`, but it does not fetch, push, or open pull requests. Automatic pushing
is enabled by default when the variable is unset.
