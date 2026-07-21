import path from "path";
import fs from "fs";
import { TestInfo } from "@playwright/test";
import { PerfCapture } from "../abstractions";

// Writes one JSON file per run for the perf-summary-reporter to aggregate.
export const PERF_OUTPUT_DIR = path.resolve("test-summary/perf");

export async function writePerfResults(
  testInfo: TestInfo,
  captures: PerfCapture[],
): Promise<void> {
  fs.mkdirSync(PERF_OUTPUT_DIR, { recursive: true });
  const safeName =
    `${testInfo.titlePath.join("__")}__run${testInfo.repeatEachIndex}`.replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );
  const payload = {
    test: testInfo.title,
    titlePath: testInfo.titlePath,
    captures,
  };
  fs.writeFileSync(
    path.join(PERF_OUTPUT_DIR, `${safeName}.json`),
    JSON.stringify(payload, null, 2),
  );
}
