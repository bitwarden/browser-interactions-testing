import path from "path";
import {
  test as base,
  chromium,
  Page,
  Worker,
  type BrowserContext,
} from "@playwright/test";
import { configDotenv } from "dotenv";

import {
  debugIsActive,
  vaultEmail,
  vaultPassword,
  vaultHostURL,
} from "../constants";
import {
  CaptureMode,
  CdpImpactResult,
  ImpactCapture,
  InPageImpactResult,
  PerfCapture,
} from "../abstractions";
import {
  closeWelcomePage,
  fetchFeatureFlags,
  type FeatureFlags,
  getBackgroundPage,
  loginToVault,
  prepareEnvironment,
  readManifestVersion,
  submitEnvironment,
} from "../fixtures/extension-setup";
import {
  createCdpCapture,
  DEFAULT_MEASURES,
  extractMeasures,
  impactWindowHeld,
  installInPageInstrumentation,
  markImpactWindow,
  readInPageImpact,
  resetInPageImpact,
  writeImpactResults,
} from "../instrumentation";
import { writePerfResults } from "./utils";

/**
 * Records one impact window.
 */
export interface ImpactRecorder {
  /** runs the workload bracketed by the CDP
   * session and the in-page accumulators, persists both channels, and returns the
   * CDP result. An empty, poisoned, or invalid capture becomes a test
   * annotation.
   *
   * The workload must not navigate. A new document gets fresh in-page
   * accumulators, and the CDP counters were baselined against the outgoing
   * one, so the capture measures a fragment of the workload while looking
   * whole. A navigation is detected and warned about rather than corrected.
   *
   * The returned result is the raw CDP reading, unfiltered by that verdict —
   * an invalidated capture still returns populated numbers. Read the
   * annotations before asserting on it.
   */
  measure(
    page: Page,
    url: string,
    workload: () => Promise<void>,
  ): Promise<CdpImpactResult>;
}

configDotenv({ quiet: true });

const pathToExtension = path.join(
  __dirname,
  "../../",
  process.env.CI ? "build" : process.env.EXTENSION_BUILD_PATH,
);

export function createBenchmarkTest(
  measureNames: readonly string[] = DEFAULT_MEASURES,
) {
  const test = base.extend<{
    background: Page | Worker;
    context: BrowserContext;
    extensionId: string;
    extensionSetup: Page;
    featureFlags: FeatureFlags;
    manifestVersion: number;
    perfCapture: void;
    impact: ImpactRecorder;
    captureMode: CaptureMode;
  }>({
    captureMode: ["default", { option: true }],
    context: async ({ browser }, use) => {
      console.log("\x1b[1m\x1b[36m%s\x1b[0m", "\tBenchmarking with:");
      console.log(
        "\x1b[1m\x1b[36m%s\x1b[0m",
        `\t${browser.browserType().name()} version ${browser.version()}`,
      );

      const context = await chromium.launchPersistentContext("", {
        acceptDownloads: false,
        headless: false,
        args: [
          ...(process.env.HEADLESS === "true" ? ["--headless=new"] : []),
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
          "--disable-dev-shm-usage",
        ],
        ignoreDefaultArgs: [
          "--disable-component-extensions-with-background-pages",
        ],
        viewport: {
          width: 1200,
          height: 1000,
        },
      });

      await Promise.all([
        context.setDefaultTimeout(20000),
        context.setDefaultNavigationTimeout(120000),
      ]);

      await use(context);

      await context.close();
    },
    background: async ({ context, manifestVersion }, use) => {
      await use(await getBackgroundPage(context, manifestVersion));
    },
    extensionId: async ({ background }, use) => {
      const extensionId = background.url().split("/")[2];
      await use(extensionId);
    },
    extensionSetup: async ({ context, extensionId }, use) => {
      let testPage: Page;

      await test.step("Close the extension welcome page when it pops up", async () => {
        testPage = await closeWelcomePage(
          context,
          !debugIsActive &&
            process.env.HEADLESS !== "true" &&
            process.env.CI === "true",
        );
      });

      await test.step("Configure the environment", async () => {
        if (vaultHostURL) {
          await prepareEnvironment(testPage, extensionId, vaultHostURL);
          await submitEnvironment(testPage);
        }
      });

      await test.step("Log in to the extension vault", async () => {
        await loginToVault(testPage, extensionId, vaultEmail, vaultPassword);
      });

      await use(testPage);
    },
    featureFlags: async ({}, use) => {
      await use(await fetchFeatureFlags(vaultHostURL));
    },
    manifestVersion: async ({}, use) => {
      const manifestVersion = readManifestVersion(pathToExtension);
      console.log(
        "\x1b[1m\x1b[36m%s\x1b[0m",
        `\textension manifest version ${manifestVersion}`,
      );
      await use(manifestVersion);
    },
    perfCapture: [
      async ({ context, extensionSetup }, use, testInfo) => {
        const captures: PerfCapture[] = [];
        const seenUrls = new Set<string>();

        const captureUrl = async (url: string) => {
          if (
            !url ||
            url === "about:blank" ||
            url.startsWith("chrome-extension://") ||
            seenUrls.has(url)
          ) {
            return;
          }
          seenUrls.add(url);
          try {
            const results = await extractMeasures(extensionSetup, measureNames);
            captures.push({
              url,
              timestamp: new Date().toISOString(),
              results,
            });
          } catch (e) {
            testInfo.annotations.push({
              type: "perf-capture-failed",
              description: `extractMeasures failed for ${url}: ${(e as Error)?.message ?? String(e)}`,
            });
          }
        };

        await context.route("**/*", async (route, request) => {
          if (
            request.isNavigationRequest() &&
            request.frame() === extensionSetup.mainFrame()
          ) {
            await captureUrl(extensionSetup.url());
          }
          await route.continue();
        });

        await use();

        await captureUrl(extensionSetup.url());
        await writePerfResults(testInfo, captures);
      },
      { auto: true },
    ],
    impact: async ({ context, extensionId, captureMode }, use, testInfo) => {
      // The impact fixture is set up only for benchmarks that request it, so
      // installing the agent here keeps it off benchmarks that never measure
      // impact. Runs during fixture setup, before the spec navigates.
      await installInPageInstrumentation(context);

      const captures: ImpactCapture[] = [];

      const snapshotLabel = `${testInfo.titlePath.join("_")}__run${testInfo.repeatEachIndex}`;

      const measure = async (
        page: Page,
        url: string,
        workload: () => Promise<void>,
      ): Promise<CdpImpactResult> => {
        const capture = createCdpCapture(context, page, {
          extensionId,
          mode: captureMode,
          snapshotLabel,
        });
        let cdp: CdpImpactResult;
        let inPage: InPageImpactResult | null = null;
        let navigated = false;

        await resetInPageImpact(page);
        await markImpactWindow(page);
        await capture.start();
        try {
          // workloads that throw are torn down by design. `finally` ensures that there are no
          // in-process actions running after a workload failure.
          await workload();
        } finally {
          // Check before reading, so the reading is known to belong to the
          // document the window opened on. Catch errors here so that CDP
          // capture stops in response to an error.
          navigated = !(await impactWindowHeld(page).catch(() => false));

          // Snapshot the in-page window before CDP teardown so it covers the
          // workload rather than the teardown, matching the trace window.
          inPage = await readInPageImpact(page);
          cdp = await capture.stop();
        }

        // The benchmark rejects its own scenario here. Both channels look
        // healthy after a navigation, so nothing downstream could tell that
        // the numbers describe whichever document the workload ended on.
        const invalidReasons: string[] = [];
        if (navigated) {
          invalidReasons.push(
            "the workload navigated during the impact window, so the capture covers only part of it; split the benchmark so each window stays on one document",
          );
        }

        for (const reason of invalidReasons) {
          const warning = `${url}: ${reason}`;
          console.warn("\x1b[1m\x1b[33m%s\x1b[0m", `\tWARNING ${warning}`);
          testInfo.annotations.push({
            type: "impact-capture-invalid",
            description: warning,
          });
        }

        // Surface a silent capture failure without discarding the data point.
        if (cdp?.poisoned) {
          testInfo.annotations.push({
            type: "impact-cdp-poisoned",
            description: `${url}: ${cdp.poisonReasons?.join("; ") ?? "unknown"}`,
          });
        }
        if (!inPage || inPage.windowMs === 0) {
          testInfo.annotations.push({
            type: "impact-in-page-empty",
            description: `no in-page impact captured for ${url}`,
          });
        }
        if (
          inPage?.supported &&
          (!inPage.supported.longTasks || !inPage.supported.loaf)
        ) {
          const missing = [
            inPage.supported.longTasks ? null : "longtask",
            inPage.supported.loaf ? null : "LoAF",
          ]
            .filter(Boolean)
            .join(", ");
          testInfo.annotations.push({
            type: "impact-in-page-unsupported",
            description: `${url}: unsupported observers: ${missing}`,
          });
        }

        captures.push({
          url,
          timestamp: new Date().toISOString(),
          inPage: inPage ?? undefined,
          cdp,
          ...(invalidReasons.length > 0 ? { invalidReasons } : {}),
        });
        return cdp;
      };

      await use({ measure });

      await writeImpactResults(testInfo, captures);
    },
  });

  return { test, expect: test.expect };
}
