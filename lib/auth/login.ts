export function safeDestination(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/listings";
}

export function authMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "E-naslov ali geslo nista pravilna.";
  }
  if (normalized.includes("email not confirmed")) {
    return "E-naslov še ni potrjen. Preverite potrditveno sporočilo.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "Povezava ni uspela. Preverite internetno povezavo in poskusite znova.";
  }
  return "Prijava ni uspela. Preverite podatke in poskusite znova.";
}

export function validateLogin(email: string, password: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { email: normalizedEmail, error: "Vnesite veljaven e-naslov." };
  }
  if (!password) return { email: normalizedEmail, error: "Vnesite geslo." };
  return { email: normalizedEmail, error: null };
}

export async function submitLogin({
  email,
  password,
  pending,
  destination,
  signIn,
  onError,
  onSuccess,
}: {
  email: string;
  password: string;
  pending: boolean;
  destination: string | null;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: { message: string } | null }>;
  onError: (message: string) => void;
  onSuccess: (destination: string) => void;
}) {
  if (pending) return false;
  const validation = validateLogin(email, password);
  if (validation.error) {
    onError(validation.error);
    return false;
  }
  try {
    const result = await signIn(validation.email, password);
    if (result.error) {
      onError(authMessage(result.error.message));
    } else {
      onSuccess(safeDestination(destination));
    }
  } catch {
    onError("Prijava ni uspela. Preverite povezavo in poskusite znova.");
  }
  return true;
}
