import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { LanguageSwitcher } from "../../components/language-switcher";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale } from "../../lib/i18n/config";

function renderSwitcher(locale: Locale) {
  return render(
    <I18nProvider locale={locale} messages={catalogs[locale]}>
      <LanguageSwitcher className="page-language" />
    </I18nProvider>,
  );
}

function clearLocaleCookie() {
  document.cookie = "roomieslo-locale=; Path=/; Max-Age=0";
}

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    refresh.mockClear();
    clearLocaleCookie();
  });
  afterEach(clearLocaleCookie);

  it("names each language in itself and marks the current one", () => {
    renderSwitcher("sl");
    const group = screen.getByRole("group", { name: "Jezik" });
    expect(group).toHaveClass("language-switcher", "page-language");
    const slovenian = screen.getByRole("button", { name: "Slovenščina" });
    const english = screen.getByRole("button", { name: "English" });
    expect(slovenian).toHaveAttribute("lang", "sl");
    expect(english).toHaveAttribute("lang", "en");
    expect(slovenian).toHaveAttribute("aria-pressed", "true");
    expect(english).toHaveAttribute("aria-pressed", "false");
  });

  it("labels the group in the active language", () => {
    renderSwitcher("en");
    expect(screen.getByRole("group", { name: "Language" })).toBeVisible();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("writes the cookie and refreshes the server tree", async () => {
    renderSwitcher("sl");
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(document.cookie).toContain("roomieslo-locale=en");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("works from the keyboard", async () => {
    const user = userEvent.setup();
    renderSwitcher("en");
    await user.tab();
    expect(screen.getByRole("button", { name: "Slovenščina" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(document.cookie).toContain("roomieslo-locale=sl");
    expect(refresh).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(screen.getByRole("button", { name: "English" })).toHaveFocus();
  });

  it("does nothing when the current language is chosen again", async () => {
    renderSwitcher("sl");
    await userEvent.click(screen.getByRole("button", { name: "Slovenščina" }));
    expect(document.cookie).not.toContain("roomieslo-locale");
    expect(refresh).not.toHaveBeenCalled();
  });
});
