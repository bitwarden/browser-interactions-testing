import path from "path";
import {
  test as base,
  chromium,
  Page,
  Worker,
  type BrowserContext,
  type BrowserContextOptions,
} from "@playwright/test";
import { configDotenv } from "dotenv";

import {
  debugIsActive,
  screenshotsOutput,
  vaultEmail,
  vaultPassword,
  vaultHostURL,
} from "../constants";
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

configDotenv({ quiet: true });

const pathToExtension = path.join(
  __dirname,
  "../../",
  process.env.CI ? "build" : process.env.EXTENSION_BUILD_PATH,
);

export const test = base.extend<{
  background: Page | Worker;
  context: BrowserContext;
  extensionId: string;
  extensionSetup: Page;
  featureFlags: FeatureFlags;
  manifestVersion: number;
  recordVideoConfig: BrowserContextOptions["recordVideo"];
  testOutputPath?: string;
}>({
  context: async ({ browser, recordVideoConfig }, use) => {
    console.log(
      "\x1b[1m\x1b[36m%s\x1b[0m", // cyan foreground
      "\tTesting with:",
    );
    console.log(
      "\x1b[1m\x1b[36m%s\x1b[0m", // cyan foreground
      `\t${browser.browserType().name()} version ${browser.version()}`,
    );

    const context = await chromium.launchPersistentContext("", {
      acceptDownloads: false, // for safety, do not accept downloads
      headless: false, // should always be `false`, even when testing headless Chrome
      args: [
        ...(process.env.HEADLESS === "true"
          ? ["--headless=new"] // use for headless testing on Chrome
          : []),
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled", // navigator.webdriver = false
        "--enable-automation=false", // This flag disables the password manager
      ],
      ignoreDefaultArgs: [
        "--disable-component-extensions-with-background-pages",
      ],
      // Help mitigate automation detection with a known-good userAgent
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      slowMo: 600,
      viewport: {
        width: 1200,
        height: 1000,
      },
      recordVideo: recordVideoConfig,
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
  extensionSetup: async ({ context, extensionId, testOutputPath }, use) => {
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

        await testPage.screenshot({
          fullPage: true,
          path: path.join(
            screenshotsOutput,
            testOutputPath,
            "browser_client_environment_configured.png",
          ),
        });

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
      "\x1b[1m\x1b[36m%s\x1b[0m", // cyan foreground
      `\textension manifest version ${manifestVersion}`,
    );
    await use(manifestVersion);
  },
  recordVideoConfig:
    process.env.DISABLE_VIDEO === "true"
      ? undefined
      : { dir: "tests-out/videos" },
  testOutputPath: "",
});

export const expect = test.expect;
