import { describe, expect, it } from "vitest";
import {
  buildSignUpInput,
  getRegistrationErrorMessage,
  normalizeRegistrationValues,
  validateRegistration,
} from "../lib/auth/registration";

describe("registration validation", () => {
  it("trims display name and normalizes email", () => {
    expect(
      normalizeRegistrationValues({
        displayName: "  Ana Novak ",
        email: " ANA@EXAMPLE.COM ",
        password: "password",
      }),
    ).toEqual({
      displayName: "Ana Novak",
      email: "ana@example.com",
      password: "password",
    });
  });

  it("requires a name, valid email, and eight-character password", () => {
    expect(
      validateRegistration({
        displayName: " ",
        email: "not-an-email",
        password: "short",
      }),
    ).toEqual({
      displayName: "Vnesi ime in priimek.",
      email: "Vnesi veljaven e-naslov.",
      password: "Geslo mora vsebovati najmanj 8 znakov.",
    });
  });

  it("builds the exact public Auth sign-up payload", () => {
    expect(
      buildSignUpInput({
        displayName: "  Ana Novak ",
        email: " ANA@EXAMPLE.COM ",
        password: "password",
      }),
    ).toEqual({
      email: "ana@example.com",
      password: "password",
      options: { data: { display_name: "Ana Novak" } },
    });
  });

  it("maps duplicate and unexpected auth errors without exposing details", () => {
    expect(
      getRegistrationErrorMessage({
        code: "user_already_exists",
        message: "secret",
      }),
    ).toContain("že obstaja");
    expect(
      getRegistrationErrorMessage({ message: "internal token detail" }),
    ).toBe("Registracije trenutno ni mogoče dokončati. Poskusi znova.");
  });
});
