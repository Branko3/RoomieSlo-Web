import {
  getDeploymentEnvironment as getEnvironmentFrom,
  isPrivilegedSupabaseKey,
  validateEnvironment as validateEnvironmentFrom,
  type DeploymentEnvironment,
  type EnvironmentInput,
  type EnvironmentValidation,
} from "./environment-validation.mjs";

export type { DeploymentEnvironment, EnvironmentValidation };

export function getDeploymentEnvironment(
  env: EnvironmentInput = process.env,
): DeploymentEnvironment {
  return getEnvironmentFrom(env);
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // A privileged key must never reach the browser client, even when misconfigured.
  if (!url || !anonKey || isPrivilegedSupabaseKey(anonKey)) {
    return { configured: false as const, url: "", anonKey: "" };
  }

  return { configured: true as const, url, anonKey };
}

export function validateEnvironment(
  env: EnvironmentInput = process.env,
): EnvironmentValidation {
  return validateEnvironmentFrom(env);
}
