/**
 * Test: Events panel and EventPopup stack correctly.
 * Opening an event from the panel should show the popup and hide the panel.
 * The panel is hidden by the app when `eventInfo` is set (see page.tsx).
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

test("clicking event from panel shows popup and hides events panel", async ({
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

  await page.goto("/", { waitUntil: "networkidle" });

  // Open events panel
  const eventsButton = page.getByRole("button", { name: /events/i });
  await expect(eventsButton).toBeVisible();
  await eventsButton.click();

  // Events panel heading should be visible
  const eventsHeading = page.getByText("Events Near You");
  await expect(eventsHeading).toBeVisible({ timeout: 5000 });

  // Event item should appear in the panel
  const eventItem = page.getByText("Test Event").first();
  await expect(eventItem).toBeVisible({ timeout: 5000 });

  // Click the event — this sets eventInfo which hides the panel
  await eventItem.click();

  // EventPopup should open (popup contains the event title or action button)
  await expect(
    page.getByText(/get directions|Test Event/i).first()
  ).toBeVisible({ timeout: 5000 });

  // Events panel heading must now be hidden (app hides panel when eventInfo is set)
  await expect(eventsHeading).not.toBeVisible();
});
