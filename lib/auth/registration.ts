export type RegistrationValues = {
  displayName: string;
  email: string;
  password: string;
  /** RoomieSlo is for university students, who must be 18 or older. */
  adultStudent: boolean;
};

export const ADULT_STUDENT_LABEL =
  "Potrjujem, da imam vsaj 18 let in sem študent(ka) univerze.";

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
    adultStudent: values.adultStudent === true,
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
  if (!normalized.adultStudent) {
    errors.adultStudent =
      "RoomieSlo je namenjen študentom, starim vsaj 18 let. Potrdi to za nadaljevanje.";
  }

  return errors;
}

export function buildSignUpInput(
  values: RegistrationValues,
  emailRedirectTo?: string,
) {
  const normalized = normalizeRegistrationValues(values);
  return {
    email: normalized.email,
    password: normalized.password,
    options: {
      // The confirmation is kept with the account (Auth user metadata), with
      // the account's creation time as its date.
      data: {
        display_name: normalized.displayName,
        adult_student_confirmed: normalized.adultStudent,
      },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
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
