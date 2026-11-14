import { expect, test } from "@playwright/test";

/**
 * P2-8: visual snapshot tests. Covers both themes (static P2-4, animated
 * P2-5), more than one layout template (P2-2), and the emphasis interface
 * (P2-6) -- enough to catch an unintended layout/theme regression without
 * snapshotting every slide.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/present.html");
  await page.locator(".stage").waitFor({ state: "visible" });
  await page.waitForTimeout(500); // let the entrance animation settle
});

test("title slide, static theme", async ({ page }) => {
  await expect(page).toHaveScreenshot("title-static.png");
});

test("title slide, animated theme", async ({ page }) => {
  await page.keyboard.press("t");
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot("title-animated.png");
});

test("bullets slide with a bullet emphasised, static theme", async ({ page }) => {
  await page.keyboard.press("ArrowRight"); // -> first bullets slide
  await page.waitForTimeout(500);
  await page.keyboard.press("2"); // emphasise the 2nd bullet-like element (1st real bullet, after the heading)
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("bullets-emphasis-static.png");
});

test("quote slide, static theme", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowRight");
  }
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot("quote-static.png");
});
