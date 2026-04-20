/**
 * Test: Popups don't overflow the screen width on a 375px (iPhone SE) viewport.
 * Opens EventPopup via the mocked events list and checks its bounding box.
 */
import { test, expect } from "@playwright/test";

const MOCK_EVENTS_RESPONSE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [77.5946, 12.9716] },
      properties: {
        title: "Test Event",
        date: "2026-05-01",
        time: "10:00 AM",
        venue: "MG Road",
        category: "Cultural",
        ticket_url: null,
        more_info_url: null,
        thumbnail: null,
        address: "MG Road Bengaluru",
      },
    },
  ],
};

test.use({ ...require("@playwright/test").devices["iPhone SE"] });

test("event popup does not overflow 375px viewport", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_done", "1");
  });

  await page.route("/api/events*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_EVENTS_RESPONSE),
    });
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // Open events panel
  const eventsButton = page.getByRole("button", { name: /events/i });
  await expect(eventsButton).toBeVisible();
  await eventsButton.click();

  // Wait for the event to appear in the list
  await expect(page.getByText("Test Event")).toBeVisible({ timeout: 5000 });

  // Click the event to open the popup
  await page.getByText("Test Event").click();

  // The popup should be visible
  const popup = page.locator("div.absolute.bottom-4").first();
  await expect(popup).toBeVisible({ timeout: 5000 });

  const viewportWidth = page.viewportSize()!.width; // 375 on iPhone SE
  const box = await popup.boundingBox();
  expect(box).not.toBeNull();

  // Popup must not start off-screen to the left
  expect(box!.x).toBeGreaterThanOrEqual(0);

  // Popup right edge must not exceed viewport width (allow 1px rounding)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
});
