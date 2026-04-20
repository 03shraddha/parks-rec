/**
 * Test: When geolocation fails, the app shows a visible error message.
 * Simulates a GPS failure by overriding navigator.geolocation in the browser.
 */
import { test, expect } from "@playwright/test";

test.use({ ...require("@playwright/test").devices["iPhone 12"] });

test("GPS failure shows error message to user", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_done", "1");

    // Override geolocation to always call the error callback
    Object.defineProperty(navigator, "geolocation", {
      writable: true,
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback
        ) => {
          error({
            code: 1,
            message: "User denied geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        },
        watchPosition: () => 0,
        clearWatch: () => {},
      },
    });
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // Open planning mode
  const searchCTA = page.getByText("Where do you want to walk?");
  await expect(searchCTA).toBeVisible();
  await searchCTA.click();

  // Find and click the GPS / current-location button inside the planning panel
  const gpsButton = page
    .getByRole("button", { name: /location|gps|current/i })
    .first();
  await expect(gpsButton).toBeVisible({ timeout: 5000 });
  await gpsButton.click();

  // An error message should appear — the app must not silently fail
  await expect(
    page.getByText(/could not get your location|location unavailable|permission denied/i)
  ).toBeVisible({ timeout: 5000 });
});
