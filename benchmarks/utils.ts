import path from "path";
import fs from "fs";
import { Page, TestInfo } from "@playwright/test";
import { PerfCapture, PerfMeasureResult } from "../abstractions";

export const DEFAULT_MEASURES: readonly string[] = ["getShadowRoot"];

export const PERF_OUTPUT_DIR = path.resolve("test-summary/perf");

// FIXME: ":autofill:bw" and "perf:enabled:autofill:bw" are public-suffix-style
// contracts with clients/apps/browser/src/autofill/content/performance.ts.
// There is no shared definition; if `NAMES_SUFFIX` or the enablement-mark name
// changes on the clients side, the suffix below silently misses every measure
// and `assertInstrumentationEnabled` reports a misleading "rebuild with
// build:extension:bench" instead of the real cause. Consider exporting both
// strings from performance.ts so the two repos cannot drift.
const PERF_MEASURE_SUFFIX = "autofill:bw";
const PERF_ENABLED_MARK = "perf:enabled:autofill:bw";

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

export async function assertInstrumentationEnabled(page: Page): Promise<void> {
  try {
    await page.waitForFunction(
      (markName) => performance.getEntriesByName(markName, "mark").length > 0,
      PERF_ENABLED_MARK,
      { timeout: 5000, polling: 100 },
    );
  } catch {
    throw new Error(
      `Autofill instrumentation marker not found on ${page.url()}. The ` +
        "extension build does not have content-script measurements enabled. " +
        "Rebuild with `npm run build:extension:bench` and re-run.",
    );
  }
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
