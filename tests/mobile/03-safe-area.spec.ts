/**
 * Test: "Walk the City" top bar text is visible and not cut off by device notch.
 * Runs on both iPhone 12 and iPhone SE.
 * Takes a screenshot per device for visual verification.
 */
import { test, expect } from "@playwright/test";

// Run this test for each device independently via parameterisation
const devices = [
  { name: "iPhone 12", width: 390, height: 844 },
  { name: "iPhone SE", width: 375, height: 667 },
];

for (const device of devices) {
  test(`safe area - top bar not cut off on ${device.name}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_done", "1");
    });

    await page.setViewportSize({ width: device.width, height: device.height });
    await page.goto("/", { waitUntil: "networkidle" });

    // "Walk the City" branding text lives in the top bar
    const logo = page.locator(".font-zen").first();
    await expect(logo).toBeVisible();

    const box = await logo.boundingBox();
    expect(box).not.toBeNull();

    // The top bar must not start at y=0 (would be behind the status bar / notch)
    expect(box!.y).toBeGreaterThan(0);

    // The text must be fully within the viewport vertically
    expect(box!.y + box!.height).toBeLessThanOrEqual(device.height);

    // Save a screenshot for manual visual verification
    await page.screenshot({
      path: `test-results/safe-area-${device.name.replace(" ", "-")}.png`,
    });
  });
}
