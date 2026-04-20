/**
 * Test: App survives portrait -> landscape -> portrait without console errors.
 * Bottom sheet must still be visible after the orientation round-trip.
 */
import { test, expect } from "@playwright/test";

test.use({ ...require("@playwright/test").devices["iPhone 12"] });

test("orientation change causes no errors and bottom sheet survives", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_done", "1");
  });

  // Collect browser console errors
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  // Collect uncaught page errors
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // Confirm bottom sheet is visible in portrait
  await expect(page.locator("div.absolute.bottom-0").first()).toBeVisible();

  // Rotate to landscape
  await page.setViewportSize({ width: 844, height: 390 });

  // Wait for layout to settle (prefer waitForSelector over fixed timeout)
  await page.waitForSelector("div.absolute.bottom-0", { state: "visible" });

  // Rotate back to portrait
  await page.setViewportSize({ width: 390, height: 844 });

  // Layout should settle again
  await page.waitForSelector("div.absolute.bottom-0", { state: "visible" });

  // No JS errors should have been thrown during orientation changes
  const jsErrors = consoleErrors.filter(
    (msg) => /error|typeerror/i.test(msg)
  );
  expect(jsErrors).toHaveLength(0);
  expect(pageErrors).toHaveLength(0);

  // Bottom sheet must still be rendered after the round-trip
  await expect(page.locator("div.absolute.bottom-0").first()).toBeVisible();
});
