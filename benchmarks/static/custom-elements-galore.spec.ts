import { createBenchmarkTest } from "../fixtures.benchmark";
import { assertInstrumentationEnabled } from "../utils";
import { defaultGotoOptions, testSiteHost } from "../../constants";

// Measure shadow DOM data collection performance. This scenario captures
// the gap between "candidates the probe scans" and "elements that actually
// carry shadow roots".
const { test } = createBenchmarkTest([
  "getShadowRoot",
  "queryShadowRoots",
  "checkForNewShadowRoots",
  "deepQueryElements",
  "queryAllTreeWalkerNodes",
]);

const URL_UNDER_TEST = `${testSiteHost}/scenarios/stability/custom-elements-galore/`;

// The page is static — the workload is the initial probe sweep that fires
// when the content script's getPageDetails runs.
const SETTLE_MS = 2_000;

test("shadow-root probe characteristics on a custom-element-heavy page", async ({
  extensionSetup,
}) => {
  await extensionSetup.goto(URL_UNDER_TEST, defaultGotoOptions);
  await assertInstrumentationEnabled(extensionSetup);

  // Hold long enough for content-script collection + observer setup to settle.
  // Without an explicit wait, the perfCapture teardown can fire before the
  // observer's first batch of mutation flushes completes.
  await extensionSetup.waitForTimeout(SETTLE_MS);
});
