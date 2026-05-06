import path from "path";

import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";
import dotenv from "dotenv";
import { defaultTestTimeout, testSiteHost } from "./constants";

dotenv.config({ path: path.resolve(__dirname, ".env"), quiet: true });

const benchmarkRuns = Number.parseInt(process.env.BENCHMARK_RUNS ?? "10", 10);

const config: PlaywrightTestConfig = {
  testDir: "./benchmarks-out",
  testIgnore: "**/tests/**",
  timeout: defaultTestTimeout,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: benchmarkRuns,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list", { printSteps: true }],
    ["./perf-summary-reporter", { inputFolder: "test-summary/perf" }],
  ],
  reportSlowTests: null,
  use: {
    actionTimeout: 0,
    baseURL: testSiteHost,
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  outputDir: "test-results/",
  webServer: {
    command: "npm run start:test-site",
    url: testSiteHost,
    reuseExistingServer: !process.env.CI,
  },
};

export default config;
