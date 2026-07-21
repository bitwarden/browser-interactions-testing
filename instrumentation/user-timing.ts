import { Page } from "@playwright/test";
import { PerfMeasureResult } from "../abstractions";

// The extension's own User-Timing marks and measures. They cross the
// isolated-world boundary on their own, so they attribute cost from the field,
// but only for paths the extension instruments.

/** Measure names captured by default when a benchmark passes none. */
export const DEFAULT_MEASURES: readonly string[] = ["getShadowRoot"];

// FIXME: these strings are an unshared contract with
// clients/apps/browser/src/autofill/content/performance.ts. A rename there
// silently zeroes every measure. Export them from performance.ts so the two
// repos cannot drift.
const PERF_MEASURE_SUFFIX = "autofill:bw";
const PERF_ENABLED_MARK = "perf:enabled:autofill:bw";

/**
 * Read the extension's User-Timing measures named `<name>:autofill:bw` and
 * reduce each to count/total/avg/min/max/stddev. A measure is poisoned when the
 * extension emitted a matching `<name>:poison:autofill:bw` mark to flag it as
 * untrustworthy.
 */
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

/**
 * Fail fast if the page shows no `perf:enabled:autofill:bw` mark, i.e. the
 * extension was not built with `BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS=true`.
 *
 * Call this only from benchmarks that actually consume User-Timing measures.
 * Specs that use only the in-page or CDP impact channels do not need an
 * instrumented build and should not call it.
 */
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
