import { expect, test, type Page } from "@playwright/test";

const validValues = {
  name: " Ana Novak ",
  email: " ANA@EXAMPLE.COM ",
  password: "password",
};

async function fillRegistrationForm(page: Page) {
  await page.getByLabel("Ime in priimek").fill(validValues.name);
  await page.getByLabel("E-naslov").fill(validValues.email);
  await page.getByLabel("Geslo").fill(validValues.password);
}

async function mockSignUp(
  page: Page,
  response: Record<string, unknown>,
  status = 200,
) {
  return page.route("**/auth/v1/signup", async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

test.describe("/register", () => {
  test("exposes labeled controls, validation associations, status announcements, and login link", async ({
    page,
  }) => {
    await page.goto("/register");

    await expect(page.getByLabel("Ime in priimek")).toBeVisible();
    await expect(page.getByLabel("E-naslov")).toBeVisible();
    await expect(page.getByLabel("Geslo")).toBeVisible();
    await expect(page.getByRole("link", { name: "Prijava" })).toHaveAttribute(
      "href",
      "/login",
    );

    await page.getByRole("button", { name: "Ustvari račun" }).click();
    await expect(page.getByRole("alert")).toHaveCount(3);
    await expect(page.getByLabel("Ime in priimek")).toHaveAttribute(
      "aria-describedby",
      "display-name-error",
    );
    await expect(page.getByLabel("E-naslov")).toHaveAttribute(
      "aria-describedby",
      "email-error",
    );
    await expect(page.getByLabel("Geslo")).toHaveAttribute(
      "aria-describedby",
      "password-error",
    );
    await expect(page.getByRole("status")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  test("focuses the first invalid control and does not call Auth", async ({
    page,
  }) => {
    let signUpCalls = 0;
    await page.route("**/auth/v1/signup", async (route) => {
      signUpCalls += 1;
      await route.continue();
    });
    await page.goto("/register");
    await page.getByLabel("E-naslov").fill("invalid");
    await page.getByLabel("Geslo").fill("short");
    await page.getByRole("button", { name: "Ustvari račun" }).click();

    await expect(page.getByLabel("Ime in priimek")).toBeFocused();
    await expect(page.getByText("Vnesi ime in priimek.")).toBeVisible();
    await expect(page.getByText("Vnesi veljaven e-naslov.")).toBeVisible();
    await expect(
      page.getByText("Geslo mora vsebovati najmanj 8 znakov."),
    ).toBeVisible();
    expect(signUpCalls).toBe(0);
  });

  test("sends the exact normalized signUp payload", async ({ page }) => {
    let payload: Record<string, unknown> | undefined;
    await page.route("**/auth/v1/signup", async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: "user-id" }, session: null }),
      });
    });
    await page.goto("/register");
    await fillRegistrationForm(page);
    await page.getByRole("button", { name: "Ustvari račun" }).click();

    await expect(page.getByRole("status")).toContainText("ana@example.com");
    expect(payload).toEqual({
      email: "ana@example.com",
      password: "password",
      options: { data: { display_name: "Ana Novak" } },
    });
  });

  test("disables submit while pending and prevents duplicate clicks", async ({
    page,
  }) => {
    let releaseResponse!: () => void;
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let signUpCalls = 0;
    await page.route("**/auth/v1/signup", async (route) => {
      signUpCalls += 1;
      await responseReleased;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: "user-id" }, session: null }),
      });
    });
    await page.goto("/register");
    await fillRegistrationForm(page);
    const submit = page.getByRole("button", { name: "Ustvari račun" });
    await submit.click();

    await expect(
      page.getByRole("button", { name: "Ustvarjam račun…" }),
    ).toBeDisabled();
    expect(signUpCalls).toBe(1);
    releaseResponse();
    await expect(page.getByRole("status")).toContainText("ana@example.com");
  });

  test("handles confirmation-required, duplicate, and generic errors safely", async ({
    page,
  }) => {
    await mockSignUp(page, { user: { id: "user-id" }, session: null });
    await page.goto("/register");
    await fillRegistrationForm(page);
    await page.getByRole("button", { name: "Ustvari račun" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Na ana@example.com smo poslali potrditveno povezavo.",
    );

    await page.unroute("**/auth/v1/signup");
    await mockSignUp(
      page,
      { code: "user_already_exists", msg: "internal account detail" },
      400,
    );
    await page.getByLabel("E-naslov").fill("other@example.com");
    await page.getByRole("button", { name: "Ustvari račun" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Račun s tem e-naslovom že obstaja.",
    );
    await expect(page.getByRole("status")).not.toContainText(
      "internal account detail",
    );

    await page.unroute("**/auth/v1/signup");
    await mockSignUp(page, { code: "unexpected", msg: "secret token" }, 500);
    await page.getByRole("button", { name: "Ustvari račun" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Registracije trenutno ni mogoče dokončati. Poskusi znova.",
    );
    await expect(page.getByRole("status")).not.toContainText("secret token");
  });
});
