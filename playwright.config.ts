import { defineConfig, devices } from "@playwright/test";

const PORT = 3311;
const baseURL = `http://localhost:${PORT}`;

/**
 * End-to-end tests run against the production build. Catalog responses are
 * mocked in the browser (see tests/e2e/fixtures.ts), so no credentials or
 * network access to a music provider are needed.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1591, height: 915 } },
    },
    {
      name: "desktop-safari",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
    },
    { name: "iphone-safari", use: { ...devices["iPhone 14"] } },
    { name: "android-chrome", use: { ...devices["Pixel 7"] } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
