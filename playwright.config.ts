import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// Playwright's own process (and the workers it spawns) run outside
// Next.js, so `DATABASE_URL`/`AUTH_SECRET`/etc. from `.env` aren't loaded
// automatically the way Next.js loads them for the dev server it spawns.
// Any spec that touches Prisma directly (see tests/e2e/wishlist.spec.ts)
// needs them in `process.env` — same `dotenv/config` mechanism
// tests/unit/setup.ts and prisma.config.ts already use.

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
