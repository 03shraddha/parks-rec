/**
 * Test: Planning mode origin input stays visible in viewport when focused.
 * Ensures the virtual keyboard doesn't push the input off-screen on iPhone 12.
 */
import { test, expect } from "@playwright/test";

test.use({ ...require("@playwright/test").devices["iPhone 12"] });

test("planning mode input is not clipped when focused", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_done", "1");
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // Open planning mode by clicking the search CTA
  const searchCTA = page.getByText("Where do you want to walk?");
  await expect(searchCTA).toBeVisible();
  await searchCTA.click();

  // Wait for origin input to appear
  const originInput = page
    .getByPlaceholder(/from|start|origin|where are you/i)
    .first();
  await expect(originInput).toBeVisible({ timeout: 5000 });

  // Check bounding box before focus — input must be within the viewport
  const viewportSize = page.viewportSize()!;
  const boxBefore = await originInput.boundingBox();
  expect(boxBefore).not.toBeNull();
  // Input top edge should be above the viewport bottom
  expect(boxBefore!.y).toBeGreaterThanOrEqual(0);
  expect(boxBefore!.y + boxBefore!.height).toBeLessThanOrEqual(
    viewportSize.height + 1 // +1 for sub-pixel rounding
  );

  // Focus the input (simulates keyboard appearing)
  await originInput.focus();

  // Input must still be within the visible area after focus
  const boxAfter = await originInput.boundingBox();
  expect(boxAfter).not.toBeNull();
  expect(boxAfter!.y).toBeGreaterThanOrEqual(0);
  // The bottom of the input should not exceed the viewport height
  expect(boxAfter!.y + boxAfter!.height).toBeLessThanOrEqual(
    viewportSize.height + 1
  );
});
