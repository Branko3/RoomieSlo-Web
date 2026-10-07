const environment = process.env.ROOMIESLO_ENV ?? "development";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const errors = [];

if (!url) errors.push("NEXT_PUBLIC_SUPABASE_URL is required.");
if (!anonKey) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
if (!["development", "staging", "production"].includes(environment)) {
  errors.push("ROOMIESLO_ENV must be development, staging, or production.");
}
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
      );
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

const result = { valid: errors.length === 0, errors };
if (!result.valid) {
  console.error("Invalid RoomieSlo environment configuration:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("RoomieSlo environment configuration is valid.");
}
