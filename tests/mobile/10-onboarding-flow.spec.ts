/**
 * Test: Onboarding overlay shows on first visit and all 3 steps work correctly.
 * NOTE: This test intentionally does NOT clear onboarding localStorage so the
 * overlay is triggered naturally (first-run behaviour).
 */
import { test, expect } from "@playwright/test";

test.use({ ...require("@playwright/test").devices["iPhone 12"] });

test("onboarding 3-step flow completes and bottom sheet appears", async ({
  page,
}) => {
  // Do NOT set onboarding_done — let the overlay show organically
  await page.goto("/", { waitUntil: "networkidle" });

  // --- Step 1 ---
  // First step should instruct the user to set their start point
  await expect(page.getByText(/set your start/i)).toBeVisible({ timeout: 5000 });

  // Step counter shows 1 / 3
  await expect(page.getByText(/1\s*\/\s*3/)).toBeVisible();

  // Advance to step 2
  const nextButton = page.getByRole("button", { name: /next/i });
  await expect(nextButton).toBeVisible();
  await nextButton.click();

  // --- Step 2 ---
  await expect(page.getByText(/set your destination/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/2\s*\/\s*3/)).toBeVisible();

  await nextButton.click();

  // --- Step 3 ---
  await expect(page.getByText(/compare your routes/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/3\s*\/\s*3/)).toBeVisible();

  // Finish button on the last step
  const finishButton = page.getByRole("button", { name: /let.s go/i });
  await expect(finishButton).toBeVisible();
  await finishButton.click();

  // Onboarding overlay / backdrop must be gone
  // The backdrop typically has a semi-transparent background covering the screen
  await expect(page.getByText(/set your start/i)).not.toBeVisible({ timeout: 3000 });
  await expect(page.getByText(/compare your routes/i)).not.toBeVisible();

  // Bottom sheet should now be accessible
  await expect(
    page.getByText("Where do you want to walk?")
  ).toBeVisible({ timeout: 5000 });
});
