import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "../../lib/i18n/config";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
const client = vi.hoisted(() => ({
  invoke: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav,
}));
vi.mock("../../components/auth-provider", () => ({
  useAuth: () => ({ signOut: auth.signOut }),
}));
vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "me", email: "ana@example.com" } },
        error: null,
      }),
      signInWithPassword: client.signInWithPassword,
    },
    functions: { invoke: client.invoke },
  }),
}));

import DeleteAccountPage from "../../app/profile/delete-account/page";
import PrivacyPage from "../../app/privacy/page";
import { AcademicDocumentUpload } from "../../components/academic-document-upload";

function inLocale(locale: Locale | null, ui: React.ReactNode) {
  const queries = new QueryClient();
  const tree = <QueryClientProvider client={queries}>{ui}</QueryClientProvider>;
  return render(
    locale ? (
      <I18nProvider locale={locale} messages={catalogs[locale]}>
        {tree}
      </I18nProvider>
    ) : (
      tree
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  client.signInWithPassword.mockResolvedValue({ error: null });
  client.invoke.mockResolvedValue({
    data: { outcome: "deleted" },
    error: null,
  });
});

describe("/profile/delete-account", () => {
  it("asks for DELETE in English and sends the canonical phrase", async () => {
    inLocale("en", <DeleteAccountPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Delete account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("permanent").tagName).toBe("B");
    const confirm = screen.getByLabelText("To confirm, type DELETE");
    const password = screen.getByLabelText("Password");
    const submit = screen.getByRole("button", {
      name: "Delete account permanently",
    });

    // The Slovenian phrase is not the English one.
    await userEvent.type(password, "geslo1234");
    await userEvent.type(confirm, "IZBRIŠI");
    await userEvent.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "To confirm, type “DELETE”.",
    );
    expect(client.invoke).not.toHaveBeenCalled();

    await userEvent.clear(confirm);
    await userEvent.type(confirm, "delete");
    await userEvent.click(submit);
    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalled());
    expect(client.invoke).toHaveBeenCalledWith("delete-account", {
      body: { confirm: "IZBRIŠI" },
    });
    expect(auth.signOut).toHaveBeenCalled();
    expect(nav.replace).toHaveBeenCalledWith("/login?deleted=1");
  });

  it("keeps the Slovenian phrase and copy", async () => {
    inLocale(null, <DeleteAccountPage />);
    expect(screen.getByText("dokončen").tagName).toBe("B");
    await userEvent.type(
      screen.getByLabelText("Za potrditev vpiši IZBRIŠI"),
      "x",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Trajno izbriši račun" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Za potrditev vpiši »IZBRIŠI«.",
    );
  });
});

describe("/privacy", () => {
  it("renders the English convenience translation with the cookie notice", () => {
    inLocale("en", <PrivacyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Your data" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/the Slovenian text prevails/)).toBeInTheDocument();
    expect(screen.getByText(/roomieslo-locale cookie/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /The controller of your personal data in the RoomieSlo app is Branko\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Delete account" }),
    ).toHaveAttribute("href", "/profile/delete-account");
    expect(
      screen.getByRole("button", { name: "Download data" }),
    ).toBeInTheDocument();
  });

  it("keeps the Slovenian notice without the translation line", () => {
    inLocale("sl", <PrivacyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Tvoji podatki" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Prevod je informativen/)).toBeNull();
    expect(
      screen.getByText(
        /Upravljavec tvojih osebnih podatkov v aplikaciji RoomieSlo je Branko\. Kontakt za zasebnost še ni nastavljen\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/piškotek roomieslo-locale/)).toBeInTheDocument();
  });

  it("shows the export error in the active language", async () => {
    inLocale("en", <PrivacyPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Download data" }),
    );
    // The mocked client has no `from`: the TypeError counts as offline.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No connection. Try again.",
    );
  });
});

describe("academic document upload", () => {
  it("says uploads are unavailable in English when Supabase isn't configured", () => {
    inLocale("en", <AcademicDocumentUpload />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Document upload isn't available right now. Try again later.",
    );
  });
});
