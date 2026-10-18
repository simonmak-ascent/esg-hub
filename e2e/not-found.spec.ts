import { test, expect } from "@playwright/test";

/**
 * Unknown routes must return HTTP 404, not a 200 with "Page Not Found" body.
 *
 * A soft 404 lets search engines index error pages, and it hid a whole class of
 * routing failures. This spec also guards the well-known route so the assertion
 * cannot pass by making everything 404.
 */
test.describe("not found handling", () => {
  for (const path of [
    "/definitely-not-a-page",
    "/environmental/definitely-not-a-page",
    "/zh/definitely-not-a-page",
  ]) {
    test(`returns 404 for ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} status`).toBe(404);
    });
  }

  test("returns 200 for a known page", async ({ page }) => {
    const response = await page.goto("/environmental");
    expect(response?.status()).toBe(200);
  });
});
