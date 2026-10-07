export type DeploymentEnvironment = "development" | "staging" | "production";

export type EnvironmentValidation = {
  valid: boolean;
  errors: string[];
};

type EnvironmentInput = Record<string, string | undefined>;

export function getDeploymentEnvironment(
  env: EnvironmentInput = process.env,
): DeploymentEnvironment {
  const value = env.ROOMIESLO_ENV;
  if (value === "staging" || value === "production") return value;
  return "development";
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { configured: false as const, url: "", anonKey: "" };
  }

  return { configured: true as const, url, anonKey };
}

export function validateEnvironment(
  env: EnvironmentInput = process.env,
): EnvironmentValidation {
  const errors: string[] = [];
  const configuredEnvironment = env.ROOMIESLO_ENV;
  const environment = getDeploymentEnvironment(env);
  if (
    configuredEnvironment !== undefined &&
    !["development", "staging", "production"].includes(configuredEnvironment)
  ) {
    errors.push("ROOMIESLO_ENV must be development, staging, or production.");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url) errors.push("NEXT_PUBLIC_SUPABASE_URL is required.");
  if (!anonKey) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");

  if (url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        errors.push("NEXT_PUBLIC_SUPABASE_URL must use http or https.");
      }
      if (
        environment !== "development" &&
        (parsed.protocol !== "https:" ||
          parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1")
      ) {
        errors.push(
          `${environment} Supabase configuration must use a non-local HTTPS URL.`,
        );
      }
    } catch {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
    }
  }

  if (anonKey) {
    const parts = anonKey.split(".");
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf8"),
        ) as { role?: string };
        if (payload.role === ["service", "role"].join("_")) {
          errors.push(
            "NEXT_PUBLIC_SUPABASE_ANON_KEY must never contain a privileged service-role key.",
          );
        }
      } catch {
        // Supabase project keys are not required to be JWTs.
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
