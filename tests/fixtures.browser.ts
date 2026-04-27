import path from "path";
import fs from "fs";
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
  defaultGotoOptions,
  defaultWaitForOptions,
  screenshotsOutput,
  vaultEmail,
  vaultPassword,
  vaultHostURL,
} from "../constants";
import { PerfCapture } from "../abstractions";
import { PERF_MEASURE_NAMES, extractMeasures, writePerfResults } from "./utils";

configDotenv({ quiet: true });

const pathToExtension = path.join(
  __dirname,
  "../../",
  process.env.CI ? "build" : process.env.EXTENSION_BUILD_PATH,
);

type FeatureFlags = { [key: string]: boolean };

export const test = base.extend<{
  background: Page | Worker;
  context: BrowserContext;
  extensionId: string;
  extensionSetup: Page;
  featureFlags: FeatureFlags;
  manifestVersion: number;
  perfCapture: void;
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

    if (process.env.BITWARDEN_ENABLE_INSTRUMENTATION === "true") {
      await context.addInitScript(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__BITWARDEN_ENABLE_INSTRUMENTATION__ = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__BITWARDEN_USE_TIMEOUT_FLUSH__ = true;
      });
    }

    await use(context);
  },
  background: async ({ context, manifestVersion }, use) => {
    let background;

    if (manifestVersion === 3) {
      background = context.serviceWorkers()[0];

      if (!background) {
        background = await context.waitForEvent("serviceworker");
      }
    } else {
      // for manifest v2:
      background = context.backgroundPages()[0];

      if (!background) {
        background = await context.waitForEvent("backgroundpage");
      }
    }

    use(background);
  },
  extensionId: async ({ background }, use) => {
    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
  extensionSetup: async ({ context, extensionId, testOutputPath }, use) => {
    let testPage: Page;

    await test.step("Close the extension welcome page when it pops up", async () => {
      // Wait for the extension to open the welcome page before continuing
      // (only relevant when using prod or build artifacts in CI)
      if (
        !debugIsActive &&
        process.env.HEADLESS !== "true" &&
        process.env.CI === "true"
      ) {
        await context.waitForEvent("page");
      }

      let contextPages = await context.pages();

      // close all but the first tab
      await Promise.all(
        contextPages.slice(1).map((contextPage) => contextPage.close()),
      );

      testPage = contextPages[0];
    });

    await test.step("Configure the environment", async () => {
      if (vaultHostURL) {
        // Dismiss the welcome carousel
        const introCarouselURL = `chrome-extension://${extensionId}/popup/index.html#/intro-carousel`;
        await testPage.goto(introCarouselURL, defaultGotoOptions);
        const welcomeCarouselDismissButton = await testPage.getByRole(
          "button",
          { name: "Log in" },
        );
        await welcomeCarouselDismissButton.click();

        const extensionURL = `chrome-extension://${extensionId}/popup/index.html#/login`;
        await testPage.goto(extensionURL, defaultGotoOptions);

        const environmentSelectorMenuButton = await testPage
          .locator("environment-selector")
          .getByRole("button");

        await environmentSelectorMenuButton.waitFor(defaultWaitForOptions);
        await environmentSelectorMenuButton.click();

        const environmentSelectorMenu = await testPage.getByRole("menuitem", {
          name: "self-hosted",
        });

        await environmentSelectorMenu.waitFor(defaultWaitForOptions);
        await environmentSelectorMenu.click();

        const baseUrlInput = await testPage.locator(
          "input#self_hosted_env_settings_form_input_base_url",
        );
        await baseUrlInput.waitFor(defaultWaitForOptions);

        await baseUrlInput.fill(vaultHostURL);

        await testPage.screenshot({
          fullPage: true,
          path: path.join(
            screenshotsOutput,
            testOutputPath,
            "browser_client_environment_configured.png",
          ),
        });

        await testPage.click("bit-dialog button[type='submit']");
      }
    });

    await test.step("Log in to the extension vault", async () => {
      const emailInput = await testPage.getByLabel("Email address");
      await emailInput.waitFor(defaultWaitForOptions);
      await emailInput.fill(vaultEmail);
      const emailSubmitInput = await testPage.getByRole("button", {
        name: "Continue",
      });
      await emailSubmitInput.click();

      const masterPasswordInput = await testPage.getByLabel("Master password");
      await masterPasswordInput.waitFor(defaultWaitForOptions);
      await masterPasswordInput.fill(vaultPassword);

      const loginButton = await testPage.getByRole("button", {
        name: "Log in with master password",
      });
      await loginButton.waitFor(defaultWaitForOptions);
      await loginButton.click();

      const extensionURL = `chrome-extension://${extensionId}/popup/index.html#/tabs/vault`;
      await testPage.waitForURL(extensionURL, defaultGotoOptions);
      // Legacy UI
      const vaultFilterBox = await testPage
        .locator("app-vault-filter main .box.list")
        .first();

      // New UI refresh
      const vaultListItems = await testPage
        .locator("app-vault-list-items-container#allItems")
        .first();

      await vaultFilterBox.or(vaultListItems).waitFor(defaultWaitForOptions);
    });

    await use(testPage);
  },
  featureFlags: async ({}, use) => {
    let flags: FeatureFlags = {};

    try {
      /**
       * We deliberately fetch the configuration from the vault server instead of
       * just pulling in the local `flags.json` because the server may or may not
       * support (and therefore return) the flags in the `flags.json` file.
       */
      const configUrl = `${vaultHostURL}/api/config`;
      const response = await fetch(configUrl, {
        method: "GET",
        headers: {
          "device-type": "2",
          "bitwarden-client-name": "browser",
        },
      });
      const data = await response.json();
      flags = data?.featureStates ?? {};
    } catch {
      console.warn(
        "\x1b[1m\x1b[33m%s\x1b[0m",
        "\tCould not fetch feature flags from server config",
      );
    }

    await use(flags);
  },
  manifestVersion: async ({}, use) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pathToExtension, "manifest.json"), "utf8"),
    );

    const manifestVersion = manifest?.manifest_version;
    console.log(
      "\x1b[1m\x1b[36m%s\x1b[0m", // cyan foreground
      `\textension manifest version ${manifestVersion}`,
    );

    use(manifestVersion);
  },
  // FIXME: this fixture depends on `extensionSetup`, forcing every test that
  // imports from `fixtures.browser.ts` through vault login even when the env
  // var is unset. All current consumers use `extensionSetup` already, so this
  // is not active today. Revisit if a test is added that does not need login.
  // FIXME: dedupe-by-URL collapses repeat visits to the same URL into a
  // single capture. Intentional for the 1-nav-1-page case; revisit if a test
  // visits → leaves → returns to the same URL and wants separate records.
  perfCapture: [
    async ({ context, extensionSetup }, use, testInfo) => {
      if (process.env.BITWARDEN_ENABLE_INSTRUMENTATION !== "true") {
        await use();
        return;
      }

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
          const results = await extractMeasures(
            extensionSetup,
            PERF_MEASURE_NAMES,
          );
          captures.push({
            url,
            timestamp: new Date().toISOString(),
            results,
          });
        } catch (e) {
          // Page may be torn down mid-extract; surface via annotation so a
          // mysteriously-empty CSV has a breadcrumb.
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
  recordVideoConfig:
    process.env.DISABLE_VIDEO === "true"
      ? undefined
      : { dir: "tests-out/videos" },
  testOutputPath: "",
});

export const expect = test.expect;
