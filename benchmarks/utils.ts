import path from "path";
import fs from "fs";
import { Page, TestInfo } from "@playwright/test";
import { PerfCapture, PerfMeasureResult } from "../abstractions";

export const DEFAULT_MEASURES: readonly string[] = ["getShadowRoot"];

export const PERF_OUTPUT_DIR = path.join(__dirname, "../test-summary/perf");

// FIXME: ":autofill:bw" is the public suffix contract from
// clients/apps/browser/src/autofill/content/performance.md. Consider exporting
// it as a constant from performance.ts so the two repos cannot drift.
const PERF_MEASURE_SUFFIX = "autofill:bw";

export async function extractMeasures(
  page: Page,
  names: readonly string[],
): Promise<Record<string, PerfMeasureResult>> {
  const lookups = names.map((name) => ({
    name,
    measureName: `${name}:${PERF_MEASURE_SUFFIX}`,
    poisonName: `${name}:poison:${PERF_MEASURE_SUFFIX}`,
  }));
  return page.evaluate((targets) => {
    const result: Record<string, PerfMeasureResult> = {};
    for (const { name, measureName, poisonName } of targets) {
      const entries = performance.getEntriesByName(measureName, "measure");
      const poisoned =
        performance.getEntriesByName(poisonName, "mark").length > 0;
      const durations = entries.map((e) => e.duration);
      const count = durations.length;
      const total = durations.reduce((s, d) => s + d, 0);
      const avg = count ? total / count : 0;
      const min = count ? Math.min(...durations) : 0;
      const max = count ? Math.max(...durations) : 0;
      const variance = count
        ? durations.reduce((s, d) => s + (d - avg) ** 2, 0) / count
        : 0;
      const stddev = Math.sqrt(variance);
      result[name] = {
        count,
        total,
        avg,
        min,
        max,
        stddev,
        poisoned,
        entries: entries.map((e) => ({
          startTime: e.startTime,
          duration: e.duration,
        })),
      };
    }
    return result;
  }, lookups);
}

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
