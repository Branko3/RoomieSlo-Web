import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";
import { describe, expect, test } from "vitest";

const repositoryRoot = path.resolve(__dirname, "..");
const workflowPath = path.join(
  repositoryRoot,
  ".github",
  "workflows",
  "quality.yml",
);
const workflowSource = fs.readFileSync(workflowPath, "utf8");
const workflowDocument = parseDocument(workflowSource);
const workflow = workflowDocument.toJS() as {
  on: { pull_request?: unknown; push?: { branches?: string[] } };
  permissions?: { contents?: string };
  jobs: {
    quality: {
      "runs-on": string;
      steps: Array<{
        name: string;
        uses?: string;
        run?: string;
        id?: string;
        if?: string;
        with?: Record<string, unknown>;
      }>;
    };
  };
};

const steps = workflow.jobs.quality.steps;
const stepNames = steps.map((step) => step.name);
const runCommands = steps.flatMap((step) => (step.run ? [step.run] : []));

describe("CI workflow contract", () => {
  test("is valid YAML with the required repository triggers and permissions", () => {
    expect(workflowDocument.errors).toEqual([]);
    expect(workflow.on.pull_request).toBeDefined();
    expect(workflow.on.push?.branches).toEqual(["main"]);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.jobs.quality["runs-on"]).toBe("ubuntu-latest");
  });

  test("uses Node 20, npm ci, and installs Chromium before E2E tests", () => {
    expect(steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Set up Node.js",
          uses: "actions/setup-node@v4",
        }),
        expect.objectContaining({
          name: "Install dependencies",
          run: "npm ci",
        }),
        expect.objectContaining({
          name: "Install Playwright Chromium",
          run: "npx playwright install --with-deps chromium",
        }),
      ]),
    );

    const nodeStep = steps.find((step) => step.name === "Set up Node.js");
    expect(nodeStep).toBeDefined();
    expect(nodeStep).toMatchObject({
      with: { "node-version": 20, cache: "npm" },
    });
    expect(stepNames.indexOf("Install Playwright Chromium")).toBeLessThan(
      stepNames.indexOf("Run end-to-end tests"),
    );
  });

  test("runs every quality command in README order without failure masking", () => {
    expect(runCommands).toEqual([
      "npm ci",
      "npx playwright install --with-deps chromium",
      "npm run typecheck",
      "npm run lint",
      "npm run format:check",
      "npm run test",
      "npm run build",
      "npm run test:e2e",
    ]);
    expect(workflowSource).not.toMatch(/continue-on-error\s*:/);
    expect(workflowSource).not.toMatch(/\|\|\s*(true|exit\s+0)/);
  });

  test("uploads Playwright diagnostics only after a failed E2E step", () => {
    const e2eStep = steps.find((step) => step.name === "Run end-to-end tests");
    const uploadStep = steps.find(
      (step) => step.name === "Upload Playwright diagnostics",
    );

    expect(e2eStep).toMatchObject({ id: "e2e", run: "npm run test:e2e" });
    expect(uploadStep).toMatchObject({
      uses: "actions/upload-artifact@v4",
      if: "${{ !cancelled() && steps.e2e.outcome == 'failure' }}",
      with: {
        name: "playwright-diagnostics",
        path: "playwright-report/\ntest-results/\n",
        "if-no-files-found": "ignore",
      },
    });
    expect(stepNames.indexOf("Upload Playwright diagnostics")).toBeGreaterThan(
      stepNames.indexOf("Run end-to-end tests"),
    );
  });
});

describe("credential-free smoke-test contract", () => {
  const smokeTestPath = path.join(
    repositoryRoot,
    "e2e",
    "contract.smoke.spec.ts",
  );
  const smokeTestSource = fs.readFileSync(smokeTestPath, "utf8");

  test("keeps public smoke tests independent of staging credentials", () => {
    expect(smokeTestSource).toContain(
      'test("starts with public Supabase configuration handling"',
    );
    expect(smokeTestSource).toContain(
      'test("preserves search filter state in the URL"',
    );
    expect(smokeTestSource).toMatch(/test\.skip\(\s*!hasStagingContract\b/);
    expect(smokeTestSource).toMatch(/test\.skip\(\s*!hasPublicStaging\b/);
    expect(smokeTestSource).toContain(
      "Requires disposable staging credentials",
    );
    expect(smokeTestSource).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(smokeTestSource).toMatch(/E2E_LISTING_ID/);
    expect(smokeTestSource).toMatch(/E2E_AUTH_STATE/);
  });

  test("does not embed private credentials or protected academic content", () => {
    const inspectedSources = `${workflowSource}\n${smokeTestSource}`;

    expect(inspectedSources).not.toMatch(
      /SUPABASE_SERVICE_ROLE_KEY|service_role|private[_ -]?token/i,
    );
    expect(inspectedSources).not.toMatch(/password\s*[:=]\s*["'][^"']+["']/i);
    expect(inspectedSources).not.toMatch(
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    );
    expect(inspectedSources).not.toMatch(/(?:\.pdf|\.docx|\.odt)\s*["'`]/i);
  });
});
