import { test, expect } from "@playwright/test";

// Locale routing is "as-needed" (APG parity): English is unprefixed (`/`),
// the other locales are prefixed (`/zh`, `/hk`).
const NON_DEFAULT = ["/zh", "/hk"];

test.describe("Locale Routing", () => {
  test("root serves the default (English) locale without a prefix", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("h1").first()).toContainText("ESG Hub");
  });

  test("locale homepages load correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1").first()).toContainText("ESG Hub");

    for (const locale of NON_DEFAULT) {
      await page.goto(locale);
      await expect(page.locator("h1").first()).toContainText("ESG");
    }
  });

  test("content pages load with locale", async ({ page }) => {
    for (const prefix of ["", ...NON_DEFAULT]) {
      await page.goto(`${prefix}/environmental`);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("static pages work with locale - search", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("h1").first()).toContainText("Search");

    for (const prefix of NON_DEFAULT) {
      await page.goto(`${prefix}/search`);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("static pages work with locale - books", async ({ page }) => {
    await page.goto("/books");
    await expect(page.locator("h1").first()).toContainText("ESG Literature");

    for (const prefix of NON_DEFAULT) {
      await page.goto(`${prefix}/books`);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("static pages work with locale - videos", async ({ page }) => {
    await page.goto("/videos");
    await expect(page.locator("h1").first()).toContainText("ESG Video Library");

    for (const prefix of NON_DEFAULT) {
      await page.goto(`${prefix}/videos`);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("static pages work with locale - contents", async ({ page }) => {
    await page.goto("/contents");
    await expect(page.locator("h1").first()).toContainText("Contents");

    for (const prefix of NON_DEFAULT) {
      await page.goto(`${prefix}/contents`);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("language switcher changes locale", async ({ page }) => {
    await page.goto("/");

    // Click on the language dropdown button (has flag emoji)
    const langButton = page.locator("button").filter({ hasText: /🇺🇸/ }).first();
    await langButton.click();

    // Wait for dropdown and click Chinese option
    await page.waitForTimeout(500);
    const chineseOption = page.locator("button").filter({ hasText: /🇨🇳/ }).first();
    await chineseOption.click();

    // Should navigate to /zh
    await expect(page).toHaveURL(/\/zh\/?$/);
  });

  test("page not found shows correct message", async ({ page }) => {
    await page.goto("/nonexistent-page-xyz");
    await expect(page.locator("h1").filter({ hasText: "Page Not Found" })).toBeVisible();
  });

  test("developers pages load with locale", async ({ page }) => {
    await page.goto("/developers");
    await expect(page.locator("h1").first()).toContainText("ESG Hub");

    for (const prefix of NON_DEFAULT) {
      await page.goto(`${prefix}/developers`);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });
});
