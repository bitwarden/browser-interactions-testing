import path from "path";

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { defaultTestTimeout, testSiteHost } from "./constants";
import { CaptureMode } from "./abstractions";

dotenv.config({ path: path.resolve(__dirname, ".env"), quiet: true });

// A manual `playwright test` runs each benchmark once. The `benchmark:*`
// commands set BENCHMARK_RUNS.
const benchmarkRuns = Number.parseInt(process.env.BENCHMARK_RUNS ?? "1", 10);

export default defineConfig<{ captureMode: CaptureMode }>({
  testDir: "./benchmarks-out",
  testIgnore: "**/tests/**",
  timeout: defaultTestTimeout,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list", { printSteps: true }],
    ["./perf-summary-reporter", { inputFolder: "test-summary/perf" }],
    [
      "./instrumentation/impact-summary-reporter",
      { inputFolder: "test-summary/impact" },
    ],
  ],
  reportSlowTests: null,
  use: {
    ...devices["Desktop Chrome"],
    actionTimeout: 0,
    baseURL: testSiteHost,
    permissions: ["clipboard-read", "clipboard-write"],
  },
  repeatEach: benchmarkRuns,
  projects: [
    // One project per CDP capture mode, selected with `--project`.
    { name: "default", use: { captureMode: "default" } },
    { name: "cpu", use: { captureMode: "cpu" } },
    { name: "snapshot", use: { captureMode: "snapshot" } },
  ],
  outputDir: "test-results/",
  webServer: {
    command: "npm run start:test-site",
    url: testSiteHost,
    reuseExistingServer: !process.env.CI,
  },
});
