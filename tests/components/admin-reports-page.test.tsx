import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

const fake = vi.hoisted(() => ({
  locale: "sl" as "sl" | "en",
  admin: true,
  reports: [] as Array<Record<string, unknown>>,
  rpc: vi.fn(),
}));

vi.mock("../../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "a1" } }, error: null }),
    },
    rpc: fake.rpc,
    from: (table: string) =>
      table === "admins"
        ? {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: fake.admin ? { user_id: "a1" } : null,
                  error: null,
                }),
              }),
            }),
          }
        : {
            select: () => ({
              order: () => ({
                limit: async () => ({ data: fake.reports, error: null }),
              }),
            }),
          },
  }),
}));

vi.mock("../../lib/i18n/server", async () => {
  const { createI18n } = await import("../../lib/i18n/i18n");
  const { catalogs } = await import("../../lib/i18n/messages");
  return {
    getI18n: async () => createI18n(fake.locale, catalogs[fake.locale]),
  };
});

const { default: AdminReportsPage } =
  await import("../../app/admin/reports/page");
const { generateMetadata } = await import("../../app/admin/layout");

function report(id: string, reason: string, extra = {}) {
  return {
    id,
    reported_id: "u1",
    reason,
    description: "",
    status: "open",
    // 10:00 UTC is 12:00 in Ljubljana (CEST).
    created_at: "2026-10-05T10:00:00Z",
    match_id: null,
    reported: { deleted_at: null },
    ...extra,
  };
}

function renderPage(locale?: "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const page = (
    <QueryClientProvider client={client}>
      <AdminReportsPage />
    </QueryClientProvider>
  );
  return render(
    locale ? (
      <I18nProvider locale={locale} messages={catalogs[locale]}>
        {page}
      </I18nProvider>
    ) : (
      page
    ),
  );
}

const item = (text: string) =>
  screen.getByText(text).closest("li") as HTMLElement;

beforeEach(() => {
  fake.admin = true;
  fake.rpc.mockReset();
  fake.reports = [
    report("r1", "Nadlegovanje", { match_id: "m1" }),
    report("r2", "Neznan razlog", {
      reported: { deleted_at: "2026-10-14T00:00:00Z" },
    }),
  ];
});

describe("Admin reports page", () => {
  it("renders in Slovenian with the stored reasons", async () => {
    renderPage();
    expect(await screen.findByText("Nadlegovanje")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Odprto (2)" }),
    ).toBeInTheDocument();
    expect(within(item("Nadlegovanje")).getByText(/prijavljen uporabnik u1/));
    expect(
      screen.getByText("Prikazanih je največ 200 najnovejših prijav."),
    ).toBeInTheDocument();
  });

  it("renders in English, mapping known reasons and keeping unknown ones", async () => {
    renderPage("en");
    expect(await screen.findByText("Harassment")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Admin dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open (2)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "All (2)" })).toBeInTheDocument();
    const known = item("Harassment");
    expect(within(known).getByText(/reported user u1/)).toBeInTheDocument();
    expect(within(known).getByText(/5 Oct 2026, 12:00/)).toBeInTheDocument();
    expect(
      within(known).getByRole("button", { name: "Mark as resolved" }),
    ).toBeInTheDocument();
    expect(
      within(known).getByRole("button", { name: "Show conversation" }),
    ).toBeInTheDocument();
    // An unknown stored reason is shown as stored; a deleted account gets a label.
    const unknown = item("Neznan razlog");
    expect(within(unknown).getByText(/Deleted user/)).toBeInTheDocument();
    expect(
      screen.getByText("Showing at most the 200 newest reports."),
    ).toBeInTheDocument();
  });

  it("shows the reported conversation with English roles", async () => {
    fake.rpc.mockResolvedValue({
      data: [
        {
          message_id: "x1",
          sender_role: "reporter",
          body: "Stop.",
          sent_at: "2026-10-05T10:00:00Z",
          source: "snapshot",
        },
        {
          message_id: "x2",
          sender_role: "reported",
          body: "No.",
          sent_at: "2026-10-05T10:01:00Z",
          source: "snapshot",
        },
      ],
      error: null,
    });
    renderPage("en");
    await userEvent.click(
      await screen.findByRole("button", { name: "Show conversation" }),
    );
    const region = await screen.findByRole("region", {
      name: "Reported conversation",
    });
    expect(await within(region).findByText("Reporter")).toBeInTheDocument();
    expect(within(region).getByText("Reported")).toBeInTheDocument();
    expect(within(region).getAllByText(/05\/10\/2026, 12:0[01]/)).toHaveLength(
      2,
    );
  });

  it("tells a non-admin in English", async () => {
    fake.admin = false;
    renderPage("en");
    expect(
      await screen.findByText("You don't have administrator rights."),
    ).toBeInTheDocument();
  });

  it("titles the dashboard in the request's language and keeps it unindexed", async () => {
    fake.locale = "sl";
    await expect(generateMetadata()).resolves.toEqual({
      title: "Administracija — RoomieSlo",
      robots: { index: false, follow: false },
    });
    fake.locale = "en";
    await expect(generateMetadata()).resolves.toMatchObject({
      title: "Administration — RoomieSlo",
      robots: { index: false, follow: false },
    });
  });
});
