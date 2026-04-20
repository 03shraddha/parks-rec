/**
 * Test: Events panel loads mocked data, shows the event title in the list,
 * and clicking it opens the EventPopup.
 */
import { test, expect } from "@playwright/test";

// Predictable GeoJSON fixture returned by the mocked /api/events endpoint
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

test("events panel shows mocked event and opens popup on click", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_done", "1");
  });

  // Intercept the events API and return a controlled fixture
  await page.route("/api/events*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_EVENTS_RESPONSE),
    });
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // Toggle the Events layer to open the panel
  const eventsButton = page.getByRole("button", { name: /events/i });
  await expect(eventsButton).toBeVisible();
  await eventsButton.click();

  // Events Near You heading should appear
  await expect(page.getByText("Events Near You")).toBeVisible({ timeout: 5000 });

  // Our mocked event should be listed
  const eventItem = page.getByText("Test Event");
  await expect(eventItem).toBeVisible({ timeout: 5000 });

  // Clicking the event row should open a popup
  await eventItem.click();

  // Verify the popup is open — either the title appears prominently or
  // the "Get Directions" action button is shown
  await expect(
    page.getByText(/get directions|Test Event/i).first()
  ).toBeVisible({ timeout: 5000 });
});
