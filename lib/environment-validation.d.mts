export type DeploymentEnvironment = "development" | "staging" | "production";

export type EnvironmentValidation = {
  valid: boolean;
  errors: string[];
};

export type EnvironmentInput = Record<string, string | undefined>;

export function getDeploymentEnvironment(
  env: EnvironmentInput,
): DeploymentEnvironment;
export function isPrivilegedSupabaseKey(key: string): boolean;
export function validateEnvironment(
  env: EnvironmentInput,
): EnvironmentValidation;
