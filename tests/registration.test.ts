import { describe, expect, it } from "vitest";
import {
  buildSignUpInput,
  getRegistrationError,
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
        adultStudent: true,
      }),
    ).toEqual({
      displayName: "Ana Novak",
      email: "ana@example.com",
      password: "password",
      adultStudent: true,
    });
  });

  it("requires a name, valid email, eight-character password and the 18+ student confirmation", () => {
    expect(
      validateRegistration({
        displayName: " ",
        email: "not-an-email",
        password: "short",
        adultStudent: false,
      }),
    ).toEqual({
      displayName: "display_name_required",
      email: "email_invalid",
      password: "password_too_short",
      adultStudent: "adult_student_required",
    });
    expect(
      validateRegistration({
        displayName: "Ana",
        email: "ana@example.com",
        password: "password",
        adultStudent: true,
      }),
    ).toEqual({});
    expect(
      validateRegistration({
        displayName: "Ana",
        email: "  ",
        password: "password",
        adultStudent: true,
      }),
    ).toEqual({ email: "email_required" });
  });

  it("builds the exact public Auth sign-up payload", () => {
    expect(
      buildSignUpInput({
        displayName: "  Ana Novak ",
        email: " ANA@EXAMPLE.COM ",
        password: "password",
        adultStudent: true,
      }),
    ).toEqual({
      email: "ana@example.com",
      password: "password",
      options: {
        data: { display_name: "Ana Novak", adult_student_confirmed: true },
      },
    });
  });

  it("sends the confirmation link back to /auth/confirm when a redirect is given", () => {
    expect(
      buildSignUpInput(
        {
          displayName: "Ana",
          email: "ana@example.com",
          password: "password",
          adultStudent: true,
        },
        "https://roomieslo.example/auth/confirm?next=%2Flistings",
      ).options,
    ).toEqual({
      data: { display_name: "Ana", adult_student_confirmed: true },
      emailRedirectTo:
        "https://roomieslo.example/auth/confirm?next=%2Flistings",
    });
  });

  it("maps duplicate and unexpected auth errors without exposing details", () => {
    expect(
      getRegistrationError({
        code: "user_already_exists",
        message: "secret",
      }),
    ).toBe("exists");
    expect(getRegistrationError({ message: "User already registered" })).toBe(
      "exists",
    );
    expect(getRegistrationError({ message: "internal token detail" })).toBe(
      "failed",
    );
  });
});
