/**
 * Test: Bottom sheet visibility, layer pills, search CTA, and Events panel close.
 * Device: iPhone 12
 */
import { test, expect } from "@playwright/test";

test.use({ ...require("@playwright/test").devices["iPhone 12"] });

test("bottom sheet visible on load, events panel opens and closes", async ({
  page,
}) => {
  // Clear onboarding so it doesn't block the UI
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_done", "1");
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // Bottom sheet should be visible — it anchors at the bottom of the screen
  const bottomSheet = page.locator("div.absolute.bottom-0").first();
  await expect(bottomSheet).toBeVisible();

  // The search CTA text should be present inside the bottom sheet
  await expect(
    page.getByText("Where do you want to walk?")
  ).toBeVisible();

  // Events layer toggle button should be present (layer pill)
  const eventsButton = page.getByRole("button", { name: /events/i });
  await expect(eventsButton).toBeVisible();

  // Toggle Events layer — the events panel should open
  await eventsButton.click();
  await expect(page.getByText("Events Near You")).toBeVisible();

  // Close the events panel using the accessible close button
  const closeButton = page.getByRole("button", {
    name: /close events panel/i,
  });
  await expect(closeButton).toBeVisible();
  await closeButton.click();

  // Events panel should no longer be visible after closing
  await expect(page.getByText("Events Near You")).not.toBeVisible();
});
