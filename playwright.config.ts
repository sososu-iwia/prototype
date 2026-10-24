import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "node scripts/start-web.mjs",
    url: "http://localhost:3001/en/team",
    env: { PORT: "3001", API_INTERNAL_URL: "http://127.0.0.1:4999/api/v1" },
    reuseExistingServer: false,
    timeout: 30000,
  },
  globalSetup: "./tests/e2e/setup.ts",
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  // Keep browser/axe and shared database fixtures sequential on CI and small hosts.
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "tablet",
      use: {
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
