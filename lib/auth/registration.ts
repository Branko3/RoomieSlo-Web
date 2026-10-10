export type RegistrationValues = {
  displayName: string;
  email: string;
  password: string;
};

export type RegistrationErrors = Partial<
  Record<keyof RegistrationValues, string>
>;

export function normalizeRegistrationValues(
  values: RegistrationValues,
): RegistrationValues {
  return {
    displayName: values.displayName.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
  };
}

export function validateRegistration(
  values: RegistrationValues,
): RegistrationErrors {
  const normalized = normalizeRegistrationValues(values);
  const errors: RegistrationErrors = {};

  if (!normalized.displayName) {
    errors.displayName = "Vnesi ime in priimek.";
  }
  if (!normalized.email) {
    errors.email = "Vnesi e-naslov.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    errors.email = "Vnesi veljaven e-naslov.";
  }
  if (normalized.password.length < 8) {
    errors.password = "Geslo mora vsebovati najmanj 8 znakov.";
  }

  return errors;
}

export function buildSignUpInput(values: RegistrationValues) {
  const normalized = normalizeRegistrationValues(values);
  return {
    email: normalized.email,
    password: normalized.password,
    options: { data: { display_name: normalized.displayName } },
  };
}

export function getRegistrationErrorMessage(error: {
  message?: string;
  code?: string;
}): string {
  const details = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (
    details.includes("user_already_exists") ||
    details.includes("already registered") ||
    details.includes("already exists")
  ) {
    return "Račun s tem e-naslovom že obstaja. Poskusi s prijavo.";
  }
  return "Registracije trenutno ni mogoče dokončati. Poskusi znova.";
}
