import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "../../lib/i18n/config";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  params: new URLSearchParams(),
}));
const auth = vi.hoisted(() => ({
  error: null as "session" | "configuration" | null,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
const supabase = vi.hoisted(() => ({ signUp: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, refresh: nav.refresh }),
  useSearchParams: () => nav.params,
}));
vi.mock("../../components/auth-provider", () => ({
  useAuth: () => ({
    pending: false,
    error: auth.error,
    signIn: auth.signIn,
    signOut: auth.signOut,
  }),
}));
vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signUp: supabase.signUp } }),
}));

import LoginPage from "../../app/login/page";
import RegisterPage from "../../app/register/page";
import { EmailConfirmationPanel } from "../../components/email-confirmation-panel";
import { LogoutButton } from "../../components/logout-button";

function inLocale(locale: Locale, ui: React.ReactNode) {
  return render(
    <I18nProvider locale={locale} messages={catalogs[locale]}>
      {ui}
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.params = new URLSearchParams();
  auth.error = null;
});

describe("/login", () => {
  it("renders in English and maps sign-in errors to English text", async () => {
    auth.signIn.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    inLocale("en", <LoginPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Sign in to your account",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/register",
    );

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address.",
    );

    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your password.");
    expect(screen.getByLabelText("Password")).toHaveFocus();

    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The email or password is incorrect.",
    );
  });

  it("keeps the Slovenian text and shows the provider's error and the deletion notice", () => {
    auth.error = "session";
    nav.params = new URLSearchParams("deleted=1");
    render(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: "Prijavi se v svoj račun" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Račun je izbrisan.");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Seje ni mogoče preveriti. Poskusite znova.",
    );
  });

  it("follows a language switch for an error already shown", async () => {
    const { rerender } = inLocale("sl", <LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Prijava" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Vnesite veljaven e-naslov.",
    );
    rerender(
      <I18nProvider locale="en" messages={catalogs.en}>
        <LoginPage />
      </I18nProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address.",
    );
  });
});

describe("/register", () => {
  it("renders in English with English field errors", async () => {
    inLocale("en", <RegisterPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Create your account" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(
      screen.getByText("Your password must be at least 8 characters long."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "RoomieSlo is for students aged 18 or over. Confirm this to continue.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveFocus();
    expect(supabase.signUp).not.toHaveBeenCalled();
  });

  async function fillAndSubmit(name: RegExp) {
    await userEvent.type(screen.getByLabelText(/Ime in priimek/), "Ana");
    await userEvent.type(screen.getByLabelText("E-naslov"), "Ana@Example.com");
    await userEvent.type(screen.getByLabelText("Geslo"), "password1");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name }));
  }

  it("confirms a new account in Slovenian with the normalized e-mail", async () => {
    supabase.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<RegisterPage />);
    await fillAndSubmit(/Ustvari račun/);
    const status = await screen.findByText(/Račun je ustvarjen/);
    expect(status).toHaveTextContent(
      "Račun je ustvarjen. Na ana@example.com smo poslali potrditveno povezavo. Preveri e-pošto in nato nadaljuj na prijavo.",
    );
    expect(status).toHaveClass("success-message");
  });

  it("maps a duplicate account to a code shown as text", async () => {
    supabase.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "user_already_exists", message: "raw" },
    });
    render(<RegisterPage />);
    await fillAndSubmit(/Ustvari račun/);
    const status = await screen.findByText(/že obstaja/);
    expect(status).toHaveClass("error-message");
    expect(status).not.toHaveTextContent("raw");
  });
});

describe("e-mail confirmation panel", () => {
  it("explains an expired link in English", () => {
    nav.params = new URLSearchParams("error=expired&email=ana@example.com");
    inLocale("en", <EmailConfirmationPanel />);
    expect(
      screen.getByRole("heading", { name: "Confirmation failed" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The confirmation link has expired.",
    );
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
  });

  it("ignores an unknown error code and keeps the Slovenian copy", async () => {
    nav.params = new URLSearchParams("error=constructor");
    render(<EmailConfirmationPanel />);
    expect(
      screen.getByRole("heading", { name: "Preveri svojo e-pošto" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Pošlji potrditveno e-sporočilo znova",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Vnesi veljaven e-naslov.",
    );
  });
});

describe("logout button", () => {
  it("signs out in English and reports a failure", async () => {
    auth.signOut.mockResolvedValue({ ok: false, error: "logout_failed" });
    inLocale("en", <LogoutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-out failed. Check your connection and try again.",
    );
  });

  it("redirects after a successful sign-out", async () => {
    auth.signOut.mockResolvedValue({ ok: true, redirectTo: "/login" });
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Odjava" }));
    expect(nav.replace).toHaveBeenCalledWith("/login");
  });
});
