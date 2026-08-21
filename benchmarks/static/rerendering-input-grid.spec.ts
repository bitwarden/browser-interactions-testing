import { createBenchmarkTest } from "../fixtures.benchmark";
import { assertInstrumentationEnabled } from "../../instrumentation";
import { StressCategory, stressTag } from "../../abstractions/stress";
import {
  defaultGotoOptions,
  defaultWaitForOptions,
  testSiteHost,
} from "../../constants";

const { test, expect } = createBenchmarkTest();

const URL_UNDER_TEST = `${testSiteHost}/scenarios/stability/rerendering-input-grid/`;

// A 200ms tick across 150 rows × 8 fillable inputs produces sustained
// field-qualification churn. The autofill queue ingests new candidates
// faster than it drains, which is the condition `getShadowRoot` is
// instrumented to surface.
//
// RERENDER_INTERVAL_MS × TARGET_TICK_COUNT (~6s base) is sized to fit
// inside TICK_COUNT_TIMEOUT_MS, which is bumped above defaultWaitForOptions
// because the catastrophic queue can stall the main thread enough to delay
// React's commit of the tick counter.
const RERENDER_INTERVAL_MS = 200;
const TARGET_TICK_COUNT = 30;
const TICK_COUNT_TIMEOUT_MS = 45_000;

// A runaway real-world page fits the taxing category.
test(
  "getShadowRoot during runaway grid rerenders",
  { tag: stressTag(StressCategory.Taxing) },
  async ({ extensionSetup }) => {
    await extensionSetup.goto(URL_UNDER_TEST, defaultGotoOptions);
    await assertInstrumentationEnabled(extensionSetup);

    const intervalInput = extensionSetup.locator(
      'input[name="rerenderInterval"]',
    );
    await intervalInput.waitFor(defaultWaitForOptions);
    await intervalInput.fill(String(RERENDER_INTERVAL_MS));

    const startButton = extensionSetup.getByRole("button", { name: "Start" });
    await startButton.waitFor(defaultWaitForOptions);
    await startButton.click();

    // The counter can skip values under load, when React batches several interval
    // ticks into one commit, so wait for it to reach the target rather than match
    // an exact value.
    const ticksLabel = extensionSetup
      .locator("span", { hasText: /Ticks:/ })
      .first();
    await ticksLabel.waitFor(defaultWaitForOptions);
    await expect
      .poll(
        async () => {
          const match = (await ticksLabel.textContent())?.match(
            /Ticks:\s*(\d+)/,
          );
          return match ? Number(match[1]) : 0;
        },
        { timeout: TICK_COUNT_TIMEOUT_MS, intervals: [100] },
      )
      .toBeGreaterThanOrEqual(TARGET_TICK_COUNT);

    const stopButton = extensionSetup.getByRole("button", { name: "Stop" });
    await stopButton.click();
    // Stop becomes disabled on the render after `running` flips to false.
    // Awaiting that transition bounds the measurement window so a tick can't
    // fire between the click and the perfCapture teardown read.
    await expect(stopButton).toBeDisabled();
  },
);
