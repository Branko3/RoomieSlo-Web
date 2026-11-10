export type RegistrationValues = {
  displayName: string;
  email: string;
  password: string;
  /** RoomieSlo is for university students, who must be 18 or older. */
  adultStudent: boolean;
};

/** Field validation failures; the page shows `m.auth.register.errors[code]`. */
export type RegistrationFieldError =
  | "display_name_required"
  | "email_required"
  | "email_invalid"
  | "password_too_short"
  | "adult_student_required";

export type RegistrationErrors = Partial<
  Record<keyof RegistrationValues, RegistrationFieldError>
>;

/** Sign-up failures reported by Supabase Auth. */
export type RegistrationError = "exists" | "failed";

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
    errors.displayName = "display_name_required";
  }
  if (!normalized.email) {
    errors.email = "email_required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    errors.email = "email_invalid";
  }
  if (normalized.password.length < 8) {
    errors.password = "password_too_short";
  }
  if (!normalized.adultStudent) {
    errors.adultStudent = "adult_student_required";
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

/** Maps a Supabase sign-up error to a code, never exposing its details. */
export function getRegistrationError(error: {
  message?: string;
  code?: string;
}): RegistrationError {
  const details = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (
    details.includes("user_already_exists") ||
    details.includes("already registered") ||
    details.includes("already exists")
  ) {
    return "exists";
  }
  return "failed";
}
