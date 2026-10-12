import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { exec, execFile } from "node:child_process";
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
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const gitExecutable = process.env.GIT_EXECUTABLE ?? "git";
const ghExecutable = process.env.GH_EXECUTABLE ?? "gh";
const baseBranch = "main";
const autoPush = process.env.COPILOT_AUTO_PUSH !== "false";
// Fetched before every feature, so worktrees start from the latest main
// without touching the main checkout.
const baseRef = autoPush ? `origin/${baseBranch}` : baseBranch;
const maxFixAttempts = parseNonNegativeInteger(
  process.env.COPILOT_MAX_FIX_ATTEMPTS ?? "2",
  "COPILOT_MAX_FIX_ATTEMPTS",
);
const agentTimeoutMs =
  parseNonNegativeInteger(
    process.env.COPILOT_AGENT_TIMEOUT_MINUTES ?? "30",
    "COPILOT_AGENT_TIMEOUT_MINUTES",
  ) *
  60 *
  1000;
if (agentTimeoutMs === 0) {
  throw new Error("COPILOT_AGENT_TIMEOUT_MINUTES must be at least 1.");
}
const concurrency = parseNonNegativeInteger(
  process.env.COPILOT_CONCURRENCY ?? "2",
  "COPILOT_CONCURRENCY",
);
if (concurrency === 0) {
  throw new Error("COPILOT_CONCURRENCY must be at least 1.");
}
const worktreeRoot = path.resolve(
  process.env.COPILOT_WORKTREE_ROOT ??
    path.join(
      path.dirname(projectRoot),
      `${path.basename(projectRoot)}-worktrees`,
    ),
);
const agentsDirectory = path.join(projectRoot, ".github", "agents");
const featureStatusFile = "docs/web-feature-status.md";

type Role = "product-manager" | "developer" | "testing";
type BacklogStatus = "Yes" | "Partial" | "No";
type TestCoverage = "Covered" | "Partially covered" | "Blocked" | "Missing";
type FeatureOutcome = "ready" | "blocked" | "gated" | "unverified";

interface BacklogFeature {
  name: string;
  phase: string;
  backlog: BacklogStatus;
  implemented: BacklogStatus;
  deferred: boolean;
  notes: string;
}

// One feature being delivered in its own git worktree.
interface FeatureRun {
  feature: BacklogFeature;
  branch: string;
  dir: string;
  label: string;
}

interface ExistingPullRequest {
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  mergedAt: string | null;
}

interface ProductReview {
  verdict: "approved" | "changes-requested" | "blocked";
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

function log(run: FeatureRun, message: string): void {
  const prefix = `[${run.label}] `;
  process.stdout.write(
    `${message
      .split(/\r?\n/)
      .map((line) => prefix + line)
      .join("\n")}\n`,
  );
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

function deny(feedback: string): PermissionRequestResult {
  return { kind: "denied-interactively-by-user", feedback };
}

function isInside(directory: string, target: string): boolean {
  const relative = path.relative(directory, target);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function permissionHandlerFor(role: Role, dir: string): PermissionHandler {
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
    // Parallel features share one machine, so keep each agent's edits inside
    // its own worktree.
    if (request.kind === "write") {
      const target =
        request.resolvedPath ?? path.resolve(dir, request.fileName);
      if (!isInside(dir, target)) {
        return deny(
          `Only edit files inside your working directory ${dir}; ${target} is outside it.`,
        );
      }
    }
    return approveAll(request, invocation);
  };
}

class AgentTimeoutError extends Error {
  constructor(role: Role, timeoutMs: number) {
    super(
      `The ${role} agent did not finish within ${timeoutMs / 60000} minutes and was aborted.`,
    );
    this.name = "AgentTimeoutError";
  }
}

async function runAgent(
  client: CopilotClient,
  run: FeatureRun,
  role: Role,
  prompt: string,
): Promise<string> {
  const session = await client.createSession({
    workingDirectory: run.dir,
    onPermissionRequest: permissionHandlerFor(role, run.dir),
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
    let response;
    try {
      response = await session.sendAndWait({ prompt }, agentTimeoutMs);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/^Timeout after \d+ms/.test(message)) {
        throw error;
      }
      // sendAndWait stops waiting but does not stop the agent, so abort it
      // before the runner touches the working tree.
      await session.abort().catch(() => undefined);
      throw new AgentTimeoutError(role, agentTimeoutMs);
    }
    if (sessionErrors.length > 0) {
      throw new Error(sessionErrors.join("; "));
    }
    if (!response?.data.content?.trim()) {
      throw new Error(
        `The ${role} agent session completed without a final assistant message.`,
      );
    }
    log(run, `${response.data.content}\n`);
    return response.data.content;
  } finally {
    await session.disconnect();
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

function normalizeFeatureRecordPath(slug: string): string {
  return `docs/features/${slug.toLowerCase()}.md`;
}

async function changedFeatureRecords(dir: string): Promise<string[]> {
  const status = await runGit(
    ["status", "--porcelain", "--untracked-files=all", "--", "docs/features"],
    dir,
  );

  return status
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.length > 3 && !line.startsWith(" D") && !line.startsWith("D "),
    )
    .map((line) => line.slice(3).split(" -> ").pop()!.replace(/^"|"$/g, ""))
    .filter((file) => /^docs\/features\/[a-z0-9][a-z0-9-]*\.md$/i.test(file));
}

// The worktree is clean when a feature starts, so any record changed on the
// feature branch belongs to this feature. Older records are never picked up.
async function requireFeatureRecordPath(
  run: FeatureRun,
  developerResponse: string,
): Promise<string> {
  const reported = [
    ...developerResponse.matchAll(
      /docs[\\/]features[\\/]([a-z0-9][a-z0-9-]*)\.md/gi,
    ),
  ].map((match) => normalizeFeatureRecordPath(match[1]));
  const changed = (await changedFeatureRecords(run.dir)).map((file) =>
    file.toLowerCase(),
  );

  const reportedAndChanged = reported.find((file) => changed.includes(file));
  if (reportedAndChanged) {
    return reportedAndChanged;
  }

  if (changed.length === 1) {
    if (reported.length > 0) {
      log(
        run,
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
    if (await fileExists(path.join(run.dir, file))) {
      log(
        run,
        `Feature record ${file} was reported but not modified on this branch; using the existing record.`,
      );
      return file;
    }
  }

  throw new Error(
    "The developer did not create or report a docs/features/<feature-slug>.md record.",
  );
}

async function readFeatureRecord(
  run: FeatureRun,
  featureRecord: string,
): Promise<string> {
  return readFile(path.join(run.dir, featureRecord), "utf8");
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
  const verdict = response.match(
    /^\s*VERDICT:\s*(APPROVED|CHANGES_REQUESTED|BLOCKED)\b/im,
  );
  const assignee = response.match(/^\s*ASSIGNEE:\s*(developer|testing)\b/im);
  const feedback = response.match(/^\s*FEEDBACK:\s*([\s\S]*)$/im);

  return {
    verdict:
      verdict?.[1].toUpperCase() === "APPROVED"
        ? "approved"
        : verdict?.[1].toUpperCase() === "BLOCKED"
          ? "blocked"
          : "changes-requested",
    assignee:
      assignee?.[1].toLowerCase() === "developer" ? "developer" : "testing",
    feedback: feedback?.[1].trim() || response.trim(),
  };
}

function parseDependencies(handoff: string): string[] {
  const line = handoff.match(/^\s*DEPENDS_ON:\s*(.+)$/im)?.[1].trim();
  if (!line || /^none\.?$/i.test(line)) {
    return [];
  }
  return line
    .split(",")
    .map((name) => name.trim().replace(/^["'`]|["'`]$/g, ""))
    .filter(Boolean);
}

function featureSlug(featureName: string): string {
  const slug = featureName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  if (!slug) {
    throw new Error(
      `Could not derive a branch name from feature "${featureName}".`,
    );
  }

  return slug;
}

function featureBranchName(featureName: string): string {
  return `agent/${featureSlug(featureName)}`;
}

function commandErrorMessage(error: unknown): string {
  return error && typeof error === "object" && "stderr" in error
    ? String(error.stderr)
    : error instanceof Error
      ? error.message
      : String(error);
}

// Worktrees share one object database and ref store, so concurrent git
// commands from parallel features can collide on lock files. Run them one at
// a time; they are quick compared with the agents.
let commandQueue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const result = commandQueue.then(task, task);
  commandQueue = result.catch(() => undefined);
  return result;
}

async function runGit(args: string[], cwd = projectRoot): Promise<string> {
  return serialized(async () => {
    try {
      const result = await execFileAsync(gitExecutable, args, {
        cwd,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      });
      // Only trim the end: porcelain output uses a leading space in status codes.
      return result.stdout.trimEnd();
    } catch (error: unknown) {
      const message = commandErrorMessage(error);
      throw new Error(
        `${gitExecutable} ${args.join(" ")} failed: ${message.trim() || "Git could not be started. Set GIT_EXECUTABLE to the full path of git.exe."}`,
      );
    }
  });
}

async function runGh(args: string[]): Promise<string> {
  return serialized(async () => {
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
  });
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

// Each feature gets its own worktree and branch from the latest main, so
// parallel features never share files and pull requests never stack.
async function prepareFeatureWorktree(
  feature: BacklogFeature,
): Promise<FeatureRun> {
  const branch = featureBranchName(feature.name);
  const label = featureSlug(feature.name);
  const dir = path.join(worktreeRoot, label);
  const run: FeatureRun = { feature, branch, dir, label };

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
  if (existsSync(dir)) {
    throw new Error(
      `Worktree folder ${dir} already exists. Inspect it, then remove it with "git worktree remove" before rerunning the workflow.`,
    );
  }

  await runGit(["worktree", "add", "-b", branch, dir, baseRef]);
  log(run, `Created worktree ${dir} on ${branch} from ${baseRef}.`);
  log(run, "Installing dependencies...");
  try {
    await execAsync("npm ci --no-audit --no-fund", {
      cwd: dir,
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error: unknown) {
    await removeWorktree(run, { deleteBranch: true });
    throw new Error(
      `npm ci failed in ${dir}: ${commandErrorMessage(error).trim()}`,
    );
  }
  return run;
}

async function removeWorktree(
  run: FeatureRun,
  options: { deleteBranch: boolean },
): Promise<void> {
  await runGit(["worktree", "remove", "--force", run.dir]);
  if (options.deleteBranch) {
    await runGit(["branch", "-D", run.branch]);
  }
}

// A failed feature that changed nothing leaves only an empty branch behind,
// which would make the next run refuse the feature. Remove it so the run can
// resume; keep any real work for inspection.
async function cleanUpFailedFeature(run: FeatureRun): Promise<void> {
  try {
    const status = await runGit(["status", "--porcelain"], run.dir);
    const commits = await runGit(
      ["log", "--oneline", `${baseRef}..${run.branch}`],
      run.dir,
    );
    if (status || commits) {
      log(
        run,
        `Leaving worktree ${run.dir} (${run.branch}) with the agents' changes for inspection. Commit or discard them, then run "git worktree remove" and delete the branch before rerunning.`,
      );
      return;
    }
    await removeWorktree(run, { deleteBranch: true });
    log(
      run,
      `Removed empty worktree and branch ${run.branch}; rerunning will restart this feature.`,
    );
  } catch (cleanupError: unknown) {
    const message =
      cleanupError instanceof Error
        ? cleanupError.message
        : String(cleanupError);
    log(run, `Could not clean up ${run.branch}: ${message}`);
  }
}

async function stageFeatureChanges(run: FeatureRun): Promise<void> {
  // Parallel pull requests that all edit the backlog table conflict with each
  // other, so the table is left for a human to update when merging.
  if (
    concurrency > 1 &&
    (await runGit(["status", "--porcelain", "--", featureStatusFile], run.dir))
  ) {
    log(
      run,
      `Reverting agent edits to ${featureStatusFile} to avoid conflicts between parallel pull requests.`,
    );
    await runGit(["checkout", "HEAD", "--", featureStatusFile], run.dir);
  }

  const status = await runGit(["status", "--porcelain"], run.dir);
  if (!status) {
    throw new Error(
      `Feature "${run.feature.name}" completed without repository changes to commit.`,
    );
  }

  await runGit(["add", "--all"], run.dir);
  const staged = (await runGit(["diff", "--cached", "--name-only"], run.dir))
    .split(/\r?\n/)
    .filter(Boolean);
  const forbidden = staged.filter((file) =>
    forbiddenStagedPathPattern.test(file),
  );
  if (forbidden.length > 0) {
    await runGit(["reset", "--quiet"], run.dir);
    throw new Error(
      `Refusing to commit generated or secret files: ${forbidden.join(", ")}. Add them to .gitignore or remove them.`,
    );
  }

  log(run, `Staged ${staged.length} file(s):\n  ${staged.join("\n  ")}`);
}

async function commitAndPublishFeature(
  run: FeatureRun,
  result: DeliveryResult,
): Promise<void> {
  await stageFeatureChanges(run);
  await runGit(["commit", "-m", `feat: ${run.feature.name}`], run.dir);

  if (!autoPush) {
    log(
      run,
      `COPILOT_AUTO_PUSH=false; feature committed locally on ${run.branch} without pushing.`,
    );
    return;
  }

  await runGit(["push", "--set-upstream", "origin", run.branch], run.dir);
  log(run, `Pushed feature branch ${run.branch} to origin.`);
  await createPullRequest(run, result);
}

async function createPullRequest(
  run: FeatureRun,
  result: DeliveryResult,
): Promise<void> {
  const draft = result.outcome !== "ready";
  const outcomeText: Record<FeatureOutcome, string> = {
    ready:
      "The product manager approved the implementation and the automated tests cover every acceptance criterion.",
    blocked:
      "The developer marked the feature record as **Blocked**. Testing was not started.",
    gated:
      "Implemented and tested as far as the agent environment allows. The remaining acceptance criteria need resources the agents cannot access, such as staging credentials or installed browsers; see the review below.",
    unverified: `The feature did not reach approved, fully covered status after ${maxFixAttempts} fix attempt(s). Review before merging.`,
  };
  const body = [
    `Automated feature delivery for **${run.feature.name}** (${run.feature.phase}).`,
    "",
    outcomeText[result.outcome],
    "",
    `- Feature record: \`${result.featureRecord}\``,
    `- Automated test status: ${result.coverage}`,
    ...(concurrency > 1
      ? [
          `- \`${featureStatusFile}\` was not updated, to avoid conflicts with parallel pull requests. Update its row when merging.`,
        ]
      : []),
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
    run.branch,
    "--title",
    `Implement ${run.feature.name}`,
    "--body",
    body,
    ...(draft ? ["--draft"] : []),
  ]);
  log(run, `Created ${draft ? "draft " : ""}pull request: ${url}`);
}

// Agents run unattended with a time limit, so they must not chase work that
// needs resources only a human can provide.
const environmentLimits = `ENVIRONMENT LIMITS: every command you run must finish on its own within a
few minutes. Do not start dev servers or watchers outside Playwright's
configured webServer, do not install browsers or system dependencies, and do
not attempt work that needs services or credentials that are not configured
(for example disposable Supabase staging credentials). Record such work as a
remaining gap in the feature record instead of attempting it.${
  concurrency > 1
    ? `

Other features are being implemented in parallel in separate folders. Only
edit files inside your working directory, and do not edit
${featureStatusFile}; the feature record is the status for this feature.`
    : ""
}`;

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

${environmentLimits}
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

Use VERDICT: BLOCKED when every remaining gap needs resources the agents
cannot obtain, such as staging credentials, external services, or browsers and
system dependencies that are not installed. Do not request that kind of work
with CHANGES_REQUESTED: another round cannot complete it. Use
CHANGES_REQUESTED only for corrections the developer or testing agent can make
in this repository with the tools already available.

End your response with exactly these lines:
VERDICT: APPROVED, VERDICT: CHANGES_REQUESTED, or VERDICT: BLOCKED
ASSIGNEE: developer or ASSIGNEE: testing
FEEDBACK: <specific, actionable corrections, or "None">`;
}

async function deliverFeature(
  client: CopilotClient,
  run: FeatureRun,
  handoff: string,
  developerResponse: string,
): Promise<DeliveryResult> {
  const featureRecord = await requireFeatureRecordPath(run, developerResponse);
  try {
    return await reviewLoop(client, run, handoff, featureRecord);
  } catch (error: unknown) {
    if (!(error instanceof AgentTimeoutError)) {
      throw error;
    }
    log(run, `${error.message} Publishing the work so far as a draft.`);
    return {
      outcome: "unverified",
      featureRecord,
      coverage: parseTestCoverage(await readFeatureRecord(run, featureRecord)),
      summary: `${error.message} Changes made before the timeout are included for review.`,
    };
  }
}

async function reviewLoop(
  client: CopilotClient,
  run: FeatureRun,
  handoff: string,
  featureRecord: string,
): Promise<DeliveryResult> {
  const { feature } = run;
  let testingFeedback: string | undefined;

  for (let attempt = 0; ; attempt += 1) {
    let contents = await readFeatureRecord(run, featureRecord);
    if (featureRecordIsBlocked(contents)) {
      log(
        run,
        `Feature record ${featureRecord} is Blocked. Preserving the blocker without starting testing.`,
      );
      return {
        outcome: "blocked",
        featureRecord,
        coverage: parseTestCoverage(contents),
        summary:
          "Not reviewed: the developer reported a blocker in the feature record.",
      };
    }

    log(run, `Testing ${featureRecord} (attempt ${attempt + 1})...`);
    const testingResponse = await runAgent(
      client,
      run,
      "testing",
      testingPrompt(featureRecord, contents, testingFeedback),
    );

    contents = await readFeatureRecord(run, featureRecord);
    const coverage = parseTestCoverage(contents);
    log(run, `Product manager is reviewing (automated status: ${coverage})...`);
    const review = parseProductReview(
      await runAgent(
        client,
        run,
        "product-manager",
        reviewPrompt(
          feature,
          featureRecord,
          contents,
          coverage,
          testingResponse,
        ),
      ),
    );

    if (review.verdict === "approved" && coverage === "Covered") {
      return {
        outcome: "ready",
        featureRecord,
        coverage,
        summary: review.feedback,
      };
    }

    if (review.verdict === "blocked") {
      return {
        outcome: "gated",
        featureRecord,
        coverage,
        summary: review.feedback,
      };
    }

    const reason =
      review.verdict === "approved"
        ? `The record's automated status is "${coverage}", not "Covered". ${review.feedback}`
        : review.feedback;

    if (attempt >= maxFixAttempts) {
      return {
        outcome: "unverified",
        featureRecord,
        coverage,
        summary: reason,
      };
    }

    if (review.assignee === "developer") {
      log(run, "Developer is addressing product-manager feedback...");
      await runAgent(
        client,
        run,
        "developer",
        `Fix the implementation of "${feature.name}" based on the product-manager review
below. Keep ${featureRecord} accurate: update acceptance criteria, implementation
notes, and the Handoff to testing section if they changed. If you are blocked,
set the record's status to Blocked and explain why.

${environmentLimits}

ORIGINAL PRODUCT-MANAGER HANDOFF:
${handoff}

REVIEW FEEDBACK:
${reason}`,
      );
    }
    testingFeedback = reason;
  }
}

async function planFeature(
  client: CopilotClient,
  run: FeatureRun,
): Promise<string> {
  const { feature } = run;
  log(run, "Product manager is preparing the handoff...");
  return runAgent(
    client,
    run,
    "product-manager",
    `Plan the next backlog feature for RoomieSlo-Web and return a complete developer handoff.

Feature selected from ${featureStatusFile}:
- Phase: ${feature.phase}
- Feature: ${feature.name}
- Backlog status: ${feature.backlog}
- Implementation status: ${feature.implemented}
- Current notes: ${feature.notes}

Use docs/web-implementation-plan.md for technical requirements and
${featureStatusFile} for scope and status. Do not implement code. Include
the user outcome, affected routes, acceptance criteria, Android behavior to
preserve, dependencies, and testing requirements. This branch starts from
${baseBranch}; call out any dependency on features that are not merged yet.

End your response with one line listing the backlog features this one must be
built on top of, using their exact names from ${featureStatusFile}:
DEPENDS_ON: <comma-separated feature names, or None>`,
  );
}

async function implementFeature(
  client: CopilotClient,
  run: FeatureRun,
  handoff: string,
): Promise<DeliveryResult> {
  const { feature } = run;
  log(run, "Developer is implementing the approved feature...");
  let developerResponse: string;
  try {
    developerResponse = await runAgent(
      client,
      run,
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
features.

${environmentLimits}`,
    );
  } catch (error: unknown) {
    const hasChanges = Boolean(
      await runGit(["status", "--porcelain"], run.dir),
    );
    if (!(error instanceof AgentTimeoutError) || !hasChanges) {
      throw error;
    }
    log(run, `${error.message} Publishing the work so far as a draft.`);
    const [featureRecord = "not created"] = await changedFeatureRecords(
      run.dir,
    );
    return {
      outcome: "unverified",
      featureRecord,
      coverage: "Missing",
      summary: `${error.message} Implementation is incomplete and untested; changes made before the timeout are included for review.`,
    };
  }

  return deliverFeature(client, run, handoff, developerResponse);
}

// Shared by all workers. Claims run one at a time so two workers never pick
// the same feature.
class Scheduler {
  readonly processed = new Set<string>();
  readonly inProgress = new Set<string>();
  // Feature name -> in-progress feature it must wait for.
  readonly waitingOn = new Map<string, string>();
  readonly errors: Error[] = [];
  completed = 0;
  private claimQueue: Promise<unknown> = Promise.resolve();
  private notify: () => void = () => undefined;
  private changed = this.nextChange();

  get stopped(): boolean {
    return this.errors.length > 0;
  }

  private nextChange(): Promise<void> {
    return new Promise((resolve) => {
      this.notify = resolve;
    });
  }

  // Wakes workers that are waiting for an in-progress feature to finish.
  signal(): void {
    this.notify();
    this.changed = this.nextChange();
  }

  waitForChange(): Promise<void> {
    return this.changed;
  }

  fail(error: unknown): void {
    this.errors.push(error instanceof Error ? error : new Error(String(error)));
    this.signal();
  }

  finish(name: string, outcome: "processed" | "released"): void {
    this.inProgress.delete(name);
    if (outcome === "processed") {
      this.processed.add(name);
    }
    this.signal();
  }

  isInProgress(name: string): string | undefined {
    const wanted = name.trim().toLowerCase();
    return [...this.inProgress].find(
      (active) => active.trim().toLowerCase() === wanted,
    );
  }

  claim(): Promise<BacklogFeature | "wait" | undefined> {
    const result = this.claimQueue.then(() => this.claimNext());
    this.claimQueue = result.catch(() => undefined);
    return result;
  }

  private async claimNext(): Promise<BacklogFeature | "wait" | undefined> {
    if (this.stopped) {
      return undefined;
    }
    if (autoPush) {
      await runGit(["fetch", "origin", baseBranch]);
    }
    const features = parseFeatureStatus(
      await runGit(["show", `${baseRef}:${featureStatusFile}`]),
    );
    let waiting = false;

    for (const feature of features) {
      if (
        feature.deferred ||
        feature.backlog === "No" ||
        feature.implemented === "Yes" ||
        this.processed.has(feature.name) ||
        this.inProgress.has(feature.name)
      ) {
        continue;
      }
      const blocker = this.waitingOn.get(feature.name);
      if (blocker && this.inProgress.has(blocker)) {
        waiting = true;
        continue;
      }

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
          this.processed.add(feature.name);
          continue;
        }

        throw new Error(
          `Feature "${feature.name}" has closed PR #${existingPullRequest.number} for ${branch} without being merged. Review it before rerunning the workflow.`,
        );
      }

      this.inProgress.add(feature.name);
      return feature;
    }

    return waiting || this.inProgress.size > 0 ? "wait" : undefined;
  }
}

async function processFeature(
  client: CopilotClient,
  scheduler: Scheduler,
  feature: BacklogFeature,
): Promise<void> {
  const run = await prepareFeatureWorktree(feature);
  log(
    run,
    `=== ${feature.name} ===\n` +
      `Phase: ${feature.phase}\n` +
      `Backlog status: ${feature.backlog}; implementation status: ${feature.implemented}\n` +
      `Notes: ${feature.notes}`,
  );

  let result: DeliveryResult;
  try {
    const handoff = await planFeature(client, run);
    const blocker = parseDependencies(handoff)
      .map((name) => scheduler.isInProgress(name))
      .find((name) => name !== undefined && name !== feature.name);
    if (blocker) {
      log(
        run,
        `Depends on "${blocker}", which is still in progress. Releasing this feature until it finishes.`,
      );
      await removeWorktree(run, { deleteBranch: true });
      scheduler.waitingOn.set(feature.name, blocker);
      scheduler.finish(feature.name, "released");
      return;
    }
    result = await implementFeature(client, run, handoff);
  } catch (error: unknown) {
    await cleanUpFailedFeature(run);
    throw error;
  }

  try {
    await commitAndPublishFeature(run, result);
  } catch (error: unknown) {
    log(
      run,
      `Publishing failed. The feature's work is still in ${run.dir} on ${run.branch}; push it and open the pull request by hand, then remove the worktree.`,
    );
    throw error;
  }
  await removeWorktree(run, { deleteBranch: false });
  scheduler.completed += 1;
  scheduler.finish(feature.name, "processed");
  log(run, `Finished with outcome "${result.outcome}".`);
}

async function worker(
  client: CopilotClient,
  scheduler: Scheduler,
): Promise<void> {
  while (true) {
    // Taken before claiming so a feature finishing during the claim still
    // wakes this worker instead of being missed.
    const change = scheduler.waitForChange();
    let claimed: BacklogFeature | "wait" | undefined;
    try {
      claimed = await scheduler.claim();
    } catch (error: unknown) {
      scheduler.fail(error);
      return;
    }
    if (claimed === undefined) {
      return;
    }
    if (claimed === "wait") {
      await change;
      continue;
    }

    try {
      await processFeature(client, scheduler, claimed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `\n[${featureSlug(claimed.name)}] Failed: ${message}\nNo new features will be started; features already in progress will finish.`,
      );
      scheduler.inProgress.delete(claimed.name);
      scheduler.fail(error);
      return;
    }
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
  const scheduler = new Scheduler();

  try {
    await client.start();
    await runGit(["worktree", "prune"]);
    console.log(
      `Running up to ${concurrency} feature(s) in parallel. Worktrees: ${worktreeRoot}`,
    );

    await Promise.all(
      Array.from({ length: concurrency }, () => worker(client, scheduler)),
    );
  } finally {
    await client.stop();
  }

  if (scheduler.errors.length > 0) {
    throw new Error(
      scheduler.errors.map((error) => error.message).join("\n---\n"),
    );
  }
  console.log(
    scheduler.completed === 0
      ? `No incomplete backlog feature remains in ${featureStatusFile}.`
      : `Orchestration completed ${scheduler.completed} feature(s). No incomplete backlog feature remains.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nWorkflow failed: ${message}`);
  process.exitCode = 1;
});
