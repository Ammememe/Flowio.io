import { defineConfig, devices } from "@playwright/test";

/** P2-8: visual snapshot tests against the present-mode page, so theme/layout changes don't silently break rendering. */
export default defineConfig({
  testDir: "./tests",
  snapshotDir: "./tests/__snapshots__",
  fullyParallel: false,
  reporter: [["list"]],
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:5174/present.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL: "http://localhost:5174",
    viewport: { width: 1280, height: 720 },
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
