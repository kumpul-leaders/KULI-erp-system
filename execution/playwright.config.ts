import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Fail fast — smoke tests only, no retry noise
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    // Take screenshot on failure for debugging
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Reuse an already-running dev server if present
    reuseExistingServer: true,
    // Next.js 16 can take a moment on first cold start
    timeout: 60_000,
  },
})
