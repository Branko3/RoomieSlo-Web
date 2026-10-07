# RoomieSlo Copilot Agent Workflow

## Available agents

The custom agents are installed in `.github/agents/`:

- `roomieslo-product-manager.agent.md`
- `roomieslo-developer.agent.md`
- `roomieslo-testing.agent.md`

These files define agent instructions. They are not continuously running background processes, so the agent sessions must be started from Copilot Chat.

## Recommended workflow

### 1. Start the product manager

Open the `RoomieSlo-Web` folder in VS Code, open GitHub Copilot Chat, choose `roomieslo-product-manager`, and use a prompt such as:

```text
Plan the next feature for RoomieSlo-Web.

Use docs/web-feature-status.md for feature scope and docs/web-implementation-plan.md for the
technical migration requirements.
Choose the highest-priority independently implementable feature.
Define:
- the user outcome;
- affected routes;
- acceptance criteria;
- Android behavior to preserve;
- implementation dependencies;
- testing requirements.

Do not implement the feature. Prepare a developer handoff.
```

The product manager should use `docs/web-feature-status.md` as the backlog and status source.

### 2. Hand off to the developer

There are two ways to perform this handoff:

#### Automatic handoff (recommended when using an orchestrator)

The product manager can give the task to the developer automatically only when it
is run inside an orchestration layer that can create or message another Copilot
session. For example, a Copilot SDK wrapper can:

1. start the product-manager session;
2. wait for its approved, structured handoff;
3. create or reuse a `roomieslo-developer` session;
4. send the handoff to that session as the next prompt; and
5. wait for the developer's completion report and feature-record path.

The wrapper can then start `roomieslo-testing` automatically after the developer
marks the feature `Implemented`. The handoff should still be persisted in
`docs/features/<feature-slug>.md`, so it remains auditable and does not depend
on chat history.

This repository now includes that runner in `orchestration/`. It reads the
ordered checklist in `docs/web-feature-status.md` and processes all incomplete
features in order after one invocation. To use it:

```powershell
Set-Location orchestration
npm install
$env:COPILOT_AUTO_APPROVE = "true"
npm run workflow
```

The runner loads the role instructions from `.github/agents/`, creates separate
Copilot SDK sessions for the product manager, developer, and testing agent, and
passes the manager's response and feature-record path between them, then
advances to the next incomplete feature automatically. Set
`COPILOT_AUTO_APPROVE` only after reviewing the prompts and trusting the
repository, because the SDK runner does not have the interactive VS Code
permission UI.

The custom-agent picker in VS Code does not provide this chaining by itself.
The `roomieslo-product-manager` profile currently has only repository
read/search/edit tools, so selecting it in a normal Copilot Chat session will
not launch or wake the developer automatically. Without an orchestration layer,
use the manual fallback below.

#### Manual fallback

Open a new Copilot Chat session, choose `roomieslo-developer`, and provide the
product manager's handoff:

```text
Implement this approved feature:

[PASTE PRODUCT MANAGER HANDOFF HERE]

Use the RoomieSlo-Web project only.

Implement the feature completely, preserve the Android behavior where specified, and create:

docs/features/<feature-slug>.md

Mark the feature as Implemented only after the acceptance criteria are satisfied.
Run the relevant validation commands and report the changed files.
```

The developer must create a feature record such as:

```text
docs/features/authenticated-route-guards.md
```

That record is the contract for the testing agent.

### 3. Start testing after implementation

When the developer reports that implementation is complete, open another Copilot Chat session, choose `roomieslo-testing`, and use:

```text
Test the newly implemented feature described in:

docs/features/<feature-slug>.md

Read the feature record and implementation first.
Write automated tests for every acceptance criterion and every scenario in
the Handoff to testing section.

Do not perform manual browser testing.
Update the same feature record with the Test status section.
Run the relevant test commands and report failures or coverage gaps.
```

Manual testing is only started when explicitly requested:

```text
Manually test the feature described in:

docs/features/<feature-slug>.md

Use the browser and check the requested desktop and mobile workflows.
Record the result and any defects. Do not modify unrelated features.
```

## Parallel feature work

Feature A testing and Feature B development can happen simultaneously:

```text
Developer A: implements Feature A
                     |
                     v
Testing A: writes tests for Feature A

Developer B: implements Feature B
                     |
                     v
Testing B: writes tests for Feature B
```

Example session layout:

| Session | Agent | Work |
|---|---|---|
| 1 | Product manager | Coordinates backlog and prepares handoffs |
| 2 | Developer | Implements Feature A |
| 3 | Testing | Tests Feature A after implementation |
| 4 | Developer | Implements Feature B in parallel |
| 5 | Testing | Tests Feature B after implementation |

Use separate branches or worktrees for parallel feature work. Do not run multiple developers in the same working directory when they may edit overlapping files.

Recommended sequence:

1. Create a branch/worktree for Feature A.
2. Start the developer agent there.
3. Create a separate branch/worktree for Feature B.
4. Start another developer agent there.
5. After Feature A is implemented, start the testing agent in Feature A's worktree.
6. After tests pass, merge Feature A.
7. Repeat the merge and testing process for Feature B.

## Agent limitations

The product manager can:

- Read the migration plan and feature status.
- Define acceptance criteria.
- Prepare developer instructions.
- Require a Markdown implementation record.
- Decide when a feature is ready for testing.
- Review test reports and identify gaps.

The product manager cannot currently:

- Automatically launch another Copilot agent.
- Automatically wake a different chat session.
- Run continuously in the background.
- Detect file changes without being prompted.
- Guarantee that another agent is using a different branch or worktree.

Therefore, handoffs between agent sessions are currently manual: copy the product manager's handoff or provide the feature-record path to the next session.

Automatic handoffs are implemented by `orchestration/workflow.ts` using the
Copilot SDK session APIs. The custom agent definitions alone still cannot launch
or wake another chat; the runner explicitly passes the handoff to the developer
and testing sessions. It also preserves the manual fallback when a delegated
session cannot be created, becomes unavailable, or reports a blocker.

## Testing commands

The testing agent can write tests, but the available testing profile may not be able to execute commands directly. After tests are created, run the commands defined in `package.json`, such as:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Do not mark a feature as `Autotested` until the relevant commands pass.

## Feature status lifecycle

Use this lifecycle for feature records:

```text
Planned
  ↓
In development
  ↓
Implemented
  ↓
Autotested
  ↓
Handtested
  ↓
Complete
```

Keep `docs/web-feature-status.md` updated after each feature. The status columns are independent:

- Implemented
- Autotested
- Handtested
