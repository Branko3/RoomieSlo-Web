import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import {
  approveAll,
  CopilotClient,
  type PermissionHandler,
  type PermissionRequestResult,
} from "@github/copilot-sdk";

const projectRoot = path.resolve(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);
const gitExecutable = process.env.GIT_EXECUTABLE ?? "git";
const ghExecutable = process.env.GH_EXECUTABLE ?? "gh";
const baseBranch = "main";
const autoPush = process.env.COPILOT_AUTO_PUSH !== "false";
const maxFixAttempts = parseNonNegativeInteger(
  process.env.COPILOT_MAX_FIX_ATTEMPTS ?? "2",
  "COPILOT_MAX_FIX_ATTEMPTS",
);
const agentsDirectory = path.join(projectRoot, ".github", "agents");
const featureStatusPath = path.join(
  projectRoot,
  "docs",
  "web-feature-status.md",
);

type Role = "product-manager" | "developer" | "testing";
type BacklogStatus = "Yes" | "Partial" | "No";
type TestCoverage = "Covered" | "Partially covered" | "Blocked" | "Missing";
type FeatureOutcome = "ready" | "blocked" | "unverified";

interface BacklogFeature {
  name: string;
  phase: string;
  backlog: BacklogStatus;
  implemented: BacklogStatus;
  deferred: boolean;
  notes: string;
}

interface ExistingPullRequest {
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  mergedAt: string | null;
}

interface ProductReview {
  approved: boolean;
  assignee: "developer" | "testing";
  feedback: string;
}

interface DeliveryResult {
  outcome: FeatureOutcome;
  featureRecord: string;
  coverage: TestCoverage;
  summary: string;
}

const roleFiles: Record<Role, string> = {
  "product-manager": "roomieslo-product-manager.agent.md",
  developer: "roomieslo-developer.agent.md",
  testing: "roomieslo-testing.agent.md",
};

// Enforced here because the agent files are injected as plain system text, so
// their `tools` frontmatter is documentation rather than a runtime boundary.
const rolePermissions: Record<Role, ReadonlySet<string>> = {
  "product-manager": new Set(["read"]),
  developer: new Set(["read", "write", "shell", "url"]),
  testing: new Set(["read", "write", "shell"]),
};

const gitCommandPattern = /(^|[\s;&|(`"'\\/])(git|gh)(\.exe)?(["'\s]|$)/i;

// Paths that must never be committed even if .gitignore is changed.
const forbiddenStagedPathPattern =
  /(^|\/)(node_modules|\.next|out|test-results|playwright-report|e2e\/\.auth)\/|(^|\/)\.env(\.[^/]*)?$|\.tsbuildinfo$/i;

function parseNonNegativeInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${value}".`);
  }
  return parsed;
}

async function loadRole(role: Role): Promise<string> {
  return readFile(path.join(agentsDirectory, roleFiles[role]), "utf8");
}

function parseStatus(value: string): BacklogStatus {
  if (value === "Yes" || value === "Partial" || value === "No") {
    return value;
  }

  throw new Error(`Unexpected feature status value: "${value}".`);
}

function parseFeatureStatus(contents: string): BacklogFeature[] {
  const features: BacklogFeature[] = [];
  let phase = "";

  for (const line of contents.split(/\r?\n/)) {
    const phaseMatch = line.match(/^### (.+)$/);
    if (phaseMatch) {
      phase = phaseMatch[1].trim();
      continue;
    }

    if (!line.startsWith("|") || line.includes("---")) {
      continue;
    }

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (
      cells.length < 6 ||
      cells[0] === "Feature" ||
      !phase ||
      !["Yes", "Partial", "No"].includes(cells[1]) ||
      !["Yes", "Partial", "No"].includes(cells[2])
    ) {
      continue;
    }

    features.push({
      name: cells[0],
      phase,
      backlog: parseStatus(cells[1]),
      implemented: parseStatus(cells[2]),
      deferred: /^Deferred:\s*Yes\b/i.test(cells[5]),
      notes: cells[5],
    });
  }

  return features;
}

async function findNextFeature(
  processedFeatures: ReadonlySet<string>,
): Promise<BacklogFeature | undefined> {
  const contents = await readFile(featureStatusPath, "utf8");
  const features = parseFeatureStatus(contents);

  return features.find(
    (feature) =>
      !processedFeatures.has(feature.name) &&
      !feature.deferred &&
      feature.backlog !== "No" && feature.implemented !== "Yes",
  );
}

function deny(feedback: string): PermissionRequestResult {
  return { kind: "denied-interactively-by-user", feedback };
}

function permissionHandlerFor(role: Role): PermissionHandler {
  if (process.env.COPILOT_AUTO_APPROVE !== "true") {
    return () =>
      deny(
        "Set COPILOT_AUTO_APPROVE=true only after reviewing the repository and workflow.",
      );
  }

  return (request, invocation) => {
    if (!rolePermissions[role].has(request.kind)) {
      return deny(
        `The ${role} agent is not allowed to request "${request.kind}" permissions in this workflow.`,
      );
    }
    if (
      request.kind === "shell" &&
      gitCommandPattern.test(request.fullCommandText)
    ) {
      return deny(
        "The orchestration runner owns Git and GitHub operations. Do not run git or gh.",
      );
    }
    return approveAll(request, invocation);
  };
}

async function runAgent(
  client: CopilotClient,
  role: Role,
  prompt: string,
): Promise<string> {
  const session = await client.createSession({
    workingDirectory: projectRoot,
    onPermissionRequest: permissionHandlerFor(role),
    systemMessage: {
      mode: "append",
      content: await loadRole(role),
    },
  });

  const sessionErrors: string[] = [];
  session.on("session.error", (event) => {
    sessionErrors.push(event.data.message);
  });

  try {
    const response = await session.sendAndWait({ prompt }, 10 * 60 * 1000);
    if (sessionErrors.length > 0) {
      throw new Error(sessionErrors.join("; "));
    }
    if (!response?.data.content?.trim()) {
      throw new Error(
        `The ${role} agent session completed without a final assistant message.`,
      );
    }
    process.stdout.write(`${response.data.content}\n`);
    return response.data.content;
  } finally {
    await session.disconnect();
    process.stdout.write("\n");
  }
}

async function fileExists(relativePath: string): Promise<boolean> {
  try {
    return (await stat(path.join(projectRoot, relativePath))).isFile();
  } catch {
    return false;
  }
}

function normalizeFeatureRecordPath(slug: string): string {
  return `docs/features/${slug.toLowerCase()}.md`;
}

async function changedFeatureRecords(): Promise<string[]> {
  const status = await runGit([
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    "docs/features",
  ]);

  return status
    .split(/\r?\n/)
    .filter((line) => line.length > 3 && !line.startsWith(" D") && !line.startsWith("D "))
    .map((line) => line.slice(3).split(" -> ").pop()!.replace(/^"|"$/g, ""))
    .filter((file) => /^docs\/features\/[a-z0-9][a-z0-9-]*\.md$/i.test(file));
}

// The working tree is clean when a feature starts, so any record changed on the
// feature branch belongs to this feature. Older records are never picked up.
async function requireFeatureRecordPath(
  developerResponse: string,
): Promise<string> {
  const reported = [
    ...developerResponse.matchAll(
      /docs[\\/]features[\\/]([a-z0-9][a-z0-9-]*)\.md/gi,
    ),
  ].map((match) => normalizeFeatureRecordPath(match[1]));
  const changed = (await changedFeatureRecords()).map((file) => file.toLowerCase());

  const reportedAndChanged = reported.find((file) => changed.includes(file));
  if (reportedAndChanged) {
    return reportedAndChanged;
  }

  if (changed.length === 1) {
    if (reported.length > 0) {
      console.warn(
        `Developer reported ${reported.join(", ")}, but only ${changed[0]} changed; using ${changed[0]}.`,
      );
    }
    return changed[0];
  }

  if (changed.length > 1) {
    throw new Error(
      `The developer changed several feature records (${changed.join(", ")}) without identifying which one belongs to this feature.`,
    );
  }

  for (const file of reported) {
    if (await fileExists(file)) {
      console.warn(
        `Feature record ${file} was reported but not modified on this branch; using the existing record.`,
      );
      return file;
    }
  }

  throw new Error(
    "The developer did not create or report a docs/features/<feature-slug>.md record.",
  );
}

async function readFeatureRecord(featureRecord: string): Promise<string> {
  return readFile(path.join(projectRoot, featureRecord), "utf8");
}

function featureRecordIsBlocked(contents: string): boolean {
  return /^\s*-\s*Status:\s*Blocked\b/im.test(contents);
}

function parseTestCoverage(contents: string): TestCoverage {
  const statuses = [
    ...contents.matchAll(/^\s*-\s*Automated status:\s*(.+?)\s*$/gim),
  ].map((match) => match[1]);
  const latest = statuses.at(-1);

  if (
    latest === "Covered" ||
    latest === "Partially covered" ||
    latest === "Blocked"
  ) {
    return latest;
  }

  return "Missing";
}

function parseProductReview(response: string): ProductReview {
  const verdict = response.match(/^\s*VERDICT:\s*(APPROVED|CHANGES_REQUESTED)\b/im);
  const assignee = response.match(/^\s*ASSIGNEE:\s*(developer|testing)\b/im);
  const feedback = response.match(/^\s*FEEDBACK:\s*([\s\S]*)$/im);

  return {
    approved: verdict?.[1].toUpperCase() === "APPROVED",
    assignee: assignee?.[1].toLowerCase() === "developer" ? "developer" : "testing",
    feedback: feedback?.[1].trim() || response.trim(),
  };
}

function featureBranchName(featureName: string): string {
  const slug = featureName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  if (!slug) {
    throw new Error(`Could not derive a branch name from feature "${featureName}".`);
  }

  return `agent/${slug}`;
}

function commandErrorMessage(error: unknown): string {
  return error && typeof error === "object" && "stderr" in error
    ? String(error.stderr)
    : error instanceof Error
      ? error.message
      : String(error);
}

async function runGit(args: string[]): Promise<string> {
  try {
    const result = await execFileAsync(gitExecutable, args, {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    // Only trim the end: porcelain output uses a leading space in status codes.
    return result.stdout.trimEnd();
  } catch (error: unknown) {
    const message = commandErrorMessage(error);
    throw new Error(
      `${gitExecutable} ${args.join(" ")} failed: ${message.trim() || "Git could not be started. Set GIT_EXECUTABLE to the full path of git.exe."}`,
    );
  }
}

async function runGh(args: string[]): Promise<string> {
  try {
    const result = await execFileAsync(ghExecutable, args, {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    return result.stdout.trim();
  } catch (error: unknown) {
    const message = commandErrorMessage(error);
    throw new Error(
      `${ghExecutable} ${args.slice(0, 2).join(" ")} failed: ${message.trim() || "GitHub CLI could not be started. Set GH_EXECUTABLE to the full path of gh.exe."}`,
    );
  }
}

async function requireCleanWorkingTree(context: string): Promise<void> {
  const status = await runGit(["status", "--porcelain"]);
  if (status) {
    throw new Error(
      `The working tree is not clean ${context}. Commit or stash existing changes before running the workflow:\n${status}`,
    );
  }
}

// Every feature branch starts from the latest main so pull requests contain
// only their own feature instead of stacking on the previous feature branch.
async function prepareFeatureBranch(featureName: string): Promise<string> {
  await requireCleanWorkingTree("before starting a feature");

  const branch = featureBranchName(featureName);
  if (autoPush) {
    await runGit(["fetch", "origin", baseBranch]);
  }
  const existingBranch = await runGit([
    "for-each-ref",
    "--format=%(refname:short)",
    `refs/heads/${branch}`,
    `refs/remotes/origin/${branch}`,
  ]);
  if (existingBranch) {
    throw new Error(
      `Feature branch "${branch}" already exists without an open or merged pull request. Review or delete it before rerunning the workflow.`,
    );
  }

  await runGit(["switch", baseBranch]);
  if (autoPush) {
    await runGit(["merge", "--ff-only", `origin/${baseBranch}`]);
  }
  await runGit(["switch", "-c", branch]);
  return branch;
}

async function returnToBaseBranch(): Promise<void> {
  await requireCleanWorkingTree("after committing the feature");
  await runGit(["switch", baseBranch]);
}

async function findExistingPullRequest(
  branch: string,
): Promise<ExistingPullRequest | undefined> {
  const output = await runGh([
    "pr",
    "list",
    "--base",
    baseBranch,
    "--head",
    branch,
    "--state",
    "all",
    "--json",
    "number,state,mergedAt",
  ]);
  const pullRequests = JSON.parse(output) as ExistingPullRequest[];
  return pullRequests[0];
}

async function stageFeatureChanges(featureName: string): Promise<void> {
  const status = await runGit(["status", "--porcelain"]);
  if (!status) {
    throw new Error(
      `Feature "${featureName}" completed without repository changes to commit.`,
    );
  }

  await runGit(["add", "--all"]);
  const staged = (await runGit(["diff", "--cached", "--name-only"]))
    .split(/\r?\n/)
    .filter(Boolean);
  const forbidden = staged.filter((file) => forbiddenStagedPathPattern.test(file));
  if (forbidden.length > 0) {
    await runGit(["reset", "--quiet"]);
    throw new Error(
      `Refusing to commit generated or secret files: ${forbidden.join(", ")}. Add them to .gitignore or remove them.`,
    );
  }

  console.log(`Staged ${staged.length} file(s):\n  ${staged.join("\n  ")}`);
}

async function commitAndPublishFeature(
  feature: BacklogFeature,
  branch: string,
  result: DeliveryResult,
): Promise<void> {
  await stageFeatureChanges(feature.name);
  await runGit(["commit", "-m", `feat: ${feature.name}`]);

  if (!autoPush) {
    console.log(
      `COPILOT_AUTO_PUSH=false; feature committed locally on ${branch} without pushing.`,
    );
    return;
  }

  await runGit(["push", "--set-upstream", "origin", branch]);
  console.log(`Pushed feature branch ${branch} to origin.`);
  await createPullRequest(feature, branch, result);
}

async function createPullRequest(
  feature: BacklogFeature,
  branch: string,
  result: DeliveryResult,
): Promise<void> {
  const draft = result.outcome !== "ready";
  const outcomeText: Record<FeatureOutcome, string> = {
    ready:
      "The product manager approved the implementation and the automated tests cover every acceptance criterion.",
    blocked:
      "The developer marked the feature record as **Blocked**. Testing was not started.",
    unverified: `The feature did not reach approved, fully covered status after ${maxFixAttempts} fix attempt(s). Review before merging.`,
  };
  const body = [
    `Automated feature delivery for **${feature.name}** (${feature.phase}).`,
    "",
    outcomeText[result.outcome],
    "",
    `- Feature record: \`${result.featureRecord}\``,
    `- Automated test status: ${result.coverage}`,
    "",
    "### Final product-manager review",
    "",
    result.summary,
  ].join("\n");

  const url = await runGh([
    "pr",
    "create",
    "--base",
    baseBranch,
    "--head",
    branch,
    "--title",
    `Implement ${feature.name}`,
    "--body",
    body,
    ...(draft ? ["--draft"] : []),
  ]);
  console.log(`Created ${draft ? "draft " : ""}pull request: ${url}`);
}

function testingPrompt(
  featureRecord: string,
  featureRecordContents: string,
  feedback: string | undefined,
): string {
  return `Test the feature described in ${featureRecord}.

Read the feature record and implementation first. Write automated tests for
every acceptance criterion and every scenario in the Handoff to testing
section. Do not perform manual browser testing. Run the relevant test commands
and update the same feature record's Test status section with the real result.
${feedback ? `\nPRODUCT-MANAGER FEEDBACK FROM THE PREVIOUS REVIEW:\n${feedback}\n` : ""}
FEATURE RECORD:
${featureRecordContents}`;
}

function reviewPrompt(
  feature: BacklogFeature,
  featureRecord: string,
  featureRecordContents: string,
  coverage: TestCoverage,
  testingResponse: string,
): string {
  return `Review the delivery of the RoomieSlo-Web feature "${feature.name}".

Inspect the implementation, the tests, and the feature record. Decide whether
every acceptance criterion is implemented and covered by passing automated
tests. Do not edit files.

Feature record path: ${featureRecord}
Automated status parsed from the record: ${coverage}

FEATURE RECORD:
${featureRecordContents}

TESTING AGENT REPORT:
${testingResponse}

End your response with exactly these lines:
VERDICT: APPROVED or VERDICT: CHANGES_REQUESTED
ASSIGNEE: developer or ASSIGNEE: testing
FEEDBACK: <specific, actionable corrections, or "None">`;
}

async function deliverFeature(
  client: CopilotClient,
  feature: BacklogFeature,
  handoff: string,
  developerResponse: string,
): Promise<DeliveryResult> {
  const featureRecord = await requireFeatureRecordPath(developerResponse);
  let testingFeedback: string | undefined;

  for (let attempt = 0; ; attempt += 1) {
    let contents = await readFeatureRecord(featureRecord);
    if (featureRecordIsBlocked(contents)) {
      console.log(
        `\nFeature record ${featureRecord} is Blocked. Preserving the blocker without starting testing.\n`,
      );
      return {
        outcome: "blocked",
        featureRecord,
        coverage: parseTestCoverage(contents),
        summary: "Not reviewed: the developer reported a blocker in the feature record.",
      };
    }

    console.log(`\nTesting ${featureRecord} (attempt ${attempt + 1})...\n`);
    const testingResponse = await runAgent(
      client,
      "testing",
      testingPrompt(featureRecord, contents, testingFeedback),
    );

    contents = await readFeatureRecord(featureRecord);
    const coverage = parseTestCoverage(contents);
    console.log(`\nProduct manager is reviewing (automated status: ${coverage})...\n`);
    const review = parseProductReview(
      await runAgent(
        client,
        "product-manager",
        reviewPrompt(feature, featureRecord, contents, coverage, testingResponse),
      ),
    );

    if (review.approved && coverage === "Covered") {
      return { outcome: "ready", featureRecord, coverage, summary: review.feedback };
    }

    const reason = review.approved
      ? `The record's automated status is "${coverage}", not "Covered". ${review.feedback}`
      : review.feedback;

    if (attempt >= maxFixAttempts) {
      return { outcome: "unverified", featureRecord, coverage, summary: reason };
    }

    if (review.assignee === "developer") {
      console.log("\nDeveloper is addressing product-manager feedback...\n");
      await runAgent(
        client,
        "developer",
        `Fix the implementation of "${feature.name}" based on the product-manager review
below. Keep ${featureRecord} accurate: update acceptance criteria, implementation
notes, and the Handoff to testing section if they changed. If you are blocked,
set the record's status to Blocked and explain why.

ORIGINAL PRODUCT-MANAGER HANDOFF:
${handoff}

REVIEW FEEDBACK:
${reason}`,
      );
    }
    testingFeedback = reason;
  }
}

async function main(): Promise<void> {
  const featureRequest = process.argv.slice(2).join(" ").trim();
  if (featureRequest) {
    throw new Error(
      "This workflow is backlog-driven and does not accept a feature request. Run npm run workflow without arguments.",
    );
  }

  const client = new CopilotClient({
    workingDirectory: projectRoot,
  });
  const processedFeatures = new Set<string>();
  let completedFeatures = 0;

  try {
    await client.start();

    while (true) {
      const feature = await findNextFeature(processedFeatures);
      if (!feature) {
        console.log(
          completedFeatures === 0
            ? "No incomplete backlog feature remains in docs/web-feature-status.md."
            : `Orchestration completed ${completedFeatures} feature(s). No incomplete backlog feature remains.`,
        );
        return;
      }

      console.log(
        `\n=== Feature ${completedFeatures + 1}: ${feature.name} ===\n` +
          `Phase: ${feature.phase}\n` +
          `Backlog status: ${feature.backlog}; implementation status: ${feature.implemented}\n` +
          `Notes: ${feature.notes}\n`,
      );
      const branch = featureBranchName(feature.name);
      const existingPullRequest = await findExistingPullRequest(branch);
      if (existingPullRequest) {
        if (
          existingPullRequest.state === "OPEN" ||
          existingPullRequest.mergedAt !== null
        ) {
          console.log(
            `Skipping "${feature.name}": PR #${existingPullRequest.number} already exists for ${branch}.`,
          );
          processedFeatures.add(feature.name);
          continue;
        }

        throw new Error(
          `Feature "${feature.name}" has closed PR #${existingPullRequest.number} for ${branch} without being merged. Review it before rerunning the workflow.`,
        );
      }

      const preparedBranch = await prepareFeatureBranch(feature.name);
      console.log(`Working on feature branch ${preparedBranch} from ${baseBranch}.\n`);
      console.log("Product manager is preparing the handoff...\n");
      const handoff = await runAgent(
        client,
        "product-manager",
        `Plan the next backlog feature for RoomieSlo-Web and return a complete developer handoff.

Feature selected from docs/web-feature-status.md:
- Phase: ${feature.phase}
- Feature: ${feature.name}
- Backlog status: ${feature.backlog}
- Implementation status: ${feature.implemented}
- Current notes: ${feature.notes}

Use docs/web-implementation-plan.md for technical requirements and
docs/web-feature-status.md for scope and status. Do not implement code. Include
the user outcome, affected routes, acceptance criteria, Android behavior to
preserve, dependencies, and testing requirements. This branch starts from
${baseBranch}; call out any dependency on features that are not merged yet.`,
      );

      console.log("\nDeveloper is implementing the approved feature...\n");
      const developerResponse = await runAgent(
        client,
        "developer",
        `Implement this exact backlog feature in the RoomieSlo-Web project now. You
have permission to edit the repository; perform the code and documentation
changes instead of returning a proposed plan.

FEATURE: ${feature.name}
PHASE: ${feature.phase}
CURRENT STATUS NOTES: ${feature.notes}

PRODUCT-MANAGER HANDOFF:
${handoff}

Before you finish, verify that a real file exists at
docs/features/<feature-slug>.md. Create the directory if necessary. The final
response must include the exact relative path, changed files, and validation
results. If blocked, set the record's status to Blocked, explain the blocker
clearly, and do not pretend the feature is complete. Do not modify unrelated
features.`,
      );

      const result = await deliverFeature(client, feature, handoff, developerResponse);
      await commitAndPublishFeature(feature, preparedBranch, result);
      await returnToBaseBranch();
      processedFeatures.add(feature.name);
      completedFeatures += 1;
      console.log(
        `\nFeature "${feature.name}" finished with outcome "${result.outcome}". Continuing with the next backlog feature.`,
      );
    }
  } finally {
    await client.stop();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nWorkflow failed: ${message}`);
  process.exitCode = 1;
});
