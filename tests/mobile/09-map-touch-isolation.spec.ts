/**
 * Test: Tapping inside an EventPopup card does not pan the map or dismiss the popup.
 * The popup should absorb pointer events so the map underneath stays still.
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

test.use({ ...require("@playwright/test").devices["iPhone 12"] });

test("tapping inside event popup does not dismiss it or cause errors", async ({
  page,
}) => {
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

  // Collect JS errors during the test
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/", { waitUntil: "networkidle" });

  // Open events panel and click the event to show the popup
  const eventsButton = page.getByRole("button", { name: /events/i });
  await expect(eventsButton).toBeVisible();
  await eventsButton.click();

  await expect(page.getByText("Test Event")).toBeVisible({ timeout: 5000 });
  await page.getByText("Test Event").click();

  // Confirm popup is open
  const popup = page.locator("div.absolute.bottom-4").first();
  await expect(popup).toBeVisible({ timeout: 5000 });

  // Tap inside the popup (on the title area) — must NOT close the popup
  const titleInPopup = page.getByText(/Test Event/i).last();
  await titleInPopup.click();

  // Popup should still be present after internal tap
  await expect(popup).toBeVisible();

  // No JS errors should have occurred
  expect(errors).toHaveLength(0);
});
