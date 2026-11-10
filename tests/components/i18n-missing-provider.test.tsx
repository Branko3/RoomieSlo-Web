import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// In the app lib/i18n/fallback.ts exports null; simulate that here (Vitest
// otherwise aliases it to the Slovenian catalog).
vi.mock("../../tests/i18n-fallback", () => ({ fallbackMessages: null }));

import { useI18n } from "../../lib/i18n/provider";

function Probe() {
  return <p>{useI18n().m.shell.signOut}</p>;
}

describe("useI18n without a provider", () => {
  it("fails with a clear error outside tests", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      "useI18n must be used inside I18nProvider",
    );
  });
});
