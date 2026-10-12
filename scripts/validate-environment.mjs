import { existsSync, readFileSync } from "node:fs";
import { validateEnvironment } from "../lib/environment-validation.mjs";

// Usage: node scripts/validate-environment.mjs [--deployment-only]
// --deployment-only (used by prebuild) validates only staging and production builds, so local
// builds without Supabase credentials keep working with preview data.

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    // Deployment-provided variables take precedence over the local file.
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^(["'])(.*)\1$/, "$2");
  }
}

loadEnvLocal();

const deploymentOnly = process.argv.includes("--deployment-only");
const environment = process.env.ROOMIESLO_ENV;
if (
  deploymentOnly &&
  (environment === undefined || environment === "development")
) {
  process.exit(0);
}

const result = validateEnvironment(process.env);
if (!result.valid) {
  console.error("Invalid RoomieSlo environment configuration:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("RoomieSlo environment configuration is valid.");
}
