import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.VITA_TEST_URL ?? "http://localhost:8083",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/serve-preview.cjs",
    url: "http://localhost:8083/preview",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "webkit-mobile",
      testMatch: /mobile-matrix\.spec\.ts/,
      use: { browserName: "webkit", hasTouch: true, isMobile: true },
    },
  ],
  reporter: "list",
  outputDir: "./artifacts/test-results",
});
