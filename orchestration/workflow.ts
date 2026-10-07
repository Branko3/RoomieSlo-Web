import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { approveAll, CopilotClient } from "@github/copilot-sdk";

const projectRoot = path.resolve(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);
const agentsDirectory = path.join(projectRoot, ".github", "agents");
const featureStatusPath = path.join(
  projectRoot,
  "docs",
  "web-feature-status.md",
);

type Role = "product-manager" | "developer" | "testing";
type BacklogStatus = "Yes" | "Partial" | "No";

interface BacklogFeature {
  name: string;
  phase: string;
  backlog: BacklogStatus;
  implemented: BacklogStatus;
  notes: string;
}

const roleFiles: Record<Role, string> = {
  "product-manager": "roomieslo-product-manager.agent.md",
  developer: "roomieslo-developer.agent.md",
  testing: "roomieslo-testing.agent.md",
};

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
      feature.backlog !== "No" && feature.implemented !== "Yes",
  );
}

async function runAgent(
  client: CopilotClient,
  role: Role,
  prompt: string,
): Promise<string> {
  const session = await client.createSession({
    workingDirectory: projectRoot,
    onPermissionRequest:
      process.env.COPILOT_AUTO_APPROVE === "true"
        ? approveAll
        : () => ({
            kind: "denied-interactively-by-user",
            feedback:
              "Set COPILOT_AUTO_APPROVE=true only after reviewing the repository and workflow.",
          }),
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

async function requireFeatureRecordPath(
  developerResponse: string,
): Promise<string> {
  const match = developerResponse.match(
    /docs[\\/]features[\\/]([a-z0-9][a-z0-9-]*)\.md/i,
  );

  if (match) {
    return path.join("docs", "features", `${match[1]}.md`);
  }

  const featuresDirectory = path.join(projectRoot, "docs", "features");
  try {
    await mkdir(featuresDirectory, { recursive: true });
    const candidates = await readdir(featuresDirectory);
    const markdownFiles = candidates.filter((file) => /^[a-z0-9][a-z0-9-]*\.md$/i.test(file));
    const filesWithTimes = await Promise.all(
      markdownFiles.map(async (file) => ({
        file,
        modifiedAt: (await stat(path.join(featuresDirectory, file))).mtimeMs,
      })),
    );
    const newest = filesWithTimes.sort(
      (left, right) => right.modifiedAt - left.modifiedAt,
    )[0];
    if (newest) {
      console.warn(
        `Developer did not report the feature-record path; using ${newest.file} found on disk.`,
      );
      return path.join("docs", "features", newest.file);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not inspect docs/features for the developer record: ${message}`);
  }

  throw new Error(
    "The developer did not create or report a docs/features/<feature-slug>.md record.",
  );
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

async function runGit(args: string[]): Promise<string> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    return result.stdout.trim();
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr)
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`git ${args.join(" ")} failed: ${message.trim()}`);
  }
}

async function prepareFeatureBranch(featureName: string): Promise<string> {
  const status = await runGit(["status", "--porcelain"]);
  if (status) {
    throw new Error(
      "The working tree is not clean before starting a feature. Commit or stash existing changes before running the workflow.",
    );
  }

  const branch = featureBranchName(featureName);
  const existingBranch = await runGit([
    "for-each-ref",
    "--format=%(refname:short)",
    `refs/heads/${branch}`,
  ]);
  if (existingBranch) {
    throw new Error(
      `Feature branch "${branch}" already exists. Refusing to overwrite it.`,
    );
  }

  await runGit(["switch", "-c", branch]);
  return branch;
}

async function commitAndPushFeature(
  featureName: string,
  branch: string,
): Promise<void> {
  if (process.env.COPILOT_AUTO_PUSH === "false") {
    console.log(
      "COPILOT_AUTO_PUSH=false; leaving feature changes committed locally without pushing.",
    );
    return;
  }

  const status = await runGit(["status", "--porcelain"]);
  if (!status) {
    throw new Error(
      `Feature "${featureName}" completed without repository changes to commit.`,
    );
  }

  await runGit(["add", "--all"]);
  await runGit([
    "commit",
    "-m",
    `feat: ${featureName}`,
    "-m",
    "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>",
  ]);
  await runGit(["push", "--set-upstream", "origin", branch]);
  console.log(`Pushed feature branch ${branch} to origin.`);
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
      const branch = await prepareFeatureBranch(feature.name);
      console.log(`Working on feature branch ${branch}.\n`);
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
preserve, dependencies, and testing requirements.`,
      );

      console.log("\nDeveloper is implementing the approved feature...\n");
      const developerResponse = await runAgent(
        client,
        "developer",
        `        Implement this exact backlog feature in the RoomieSlo-Web project now. You
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
results. If blocked, explain the blocker clearly and do not pretend the
feature is complete. Do not modify unrelated features.`,
      );

      const featureRecord = await requireFeatureRecordPath(developerResponse);
      const featureRecordContents = await readFile(
        path.join(projectRoot, featureRecord),
        "utf8",
      );

      console.log(`\nTesting ${featureRecord}...\n`);
      const testingResponse = await runAgent(
        client,
        "testing",
        `Test the newly implemented feature described in ${featureRecord}.

Read the feature record and implementation first. Write automated tests for
every acceptance criterion and every scenario in the Handoff to testing
section. Do not perform manual browser testing. Update the same feature record
with the Test status section and run the relevant test commands.

FEATURE RECORD:
${featureRecordContents}`,
      );

      if (!testingResponse.trim()) {
        throw new Error(
          `The testing agent returned an empty response for "${feature.name}".`,
        );
      }

      await commitAndPushFeature(feature.name, branch);
      processedFeatures.add(feature.name);
      completedFeatures += 1;
      console.log(
        `\nFeature "${feature.name}" completed. Continuing with the next backlog feature.`,
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
