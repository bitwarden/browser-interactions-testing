import { createBenchmarkTest } from "../fixtures.benchmark";
import { assertInstrumentationEnabled } from "../utils";
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

test("getShadowRoot during runaway grid rerenders", async ({
  extensionSetup,
}) => {
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

  await extensionSetup
    .getByText(`Ticks: ${TARGET_TICK_COUNT}`, { exact: true })
    .waitFor({ ...defaultWaitForOptions, timeout: TICK_COUNT_TIMEOUT_MS });

  const stopButton = extensionSetup.getByRole("button", { name: "Stop" });
  await stopButton.click();
  // Stop becomes disabled on the render after `running` flips to false.
  // Awaiting that transition bounds the measurement window so a tick can't
  // fire between the click and the perfCapture teardown read.
  await expect(stopButton).toBeDisabled();
});
