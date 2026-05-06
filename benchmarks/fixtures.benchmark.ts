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
import { PerfCapture } from "../abstractions";
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
import { DEFAULT_MEASURES, extractMeasures, writePerfResults } from "./utils";

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
  }>({
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
  });

  return { test, expect: test.expect };
}
