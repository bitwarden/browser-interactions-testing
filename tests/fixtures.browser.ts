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

configDotenv();

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
        const extensionURL = `chrome-extension://${extensionId}/popup/index.html#/login`;
        await testPage.goto(extensionURL, defaultGotoOptions);

        const welcomeCarouselDismissButton = await testPage.getByRole(
          "button",
          { name: "Log in" },
        );

        if (welcomeCarouselDismissButton) {
          welcomeCarouselDismissButton.click();
        }

        const environmentSelectorMenuButton = await testPage
          .locator("environment-selector")
          .getByRole("button");

        await environmentSelectorMenuButton.waitFor(defaultWaitForOptions);
        await environmentSelectorMenuButton.click();

        const environmentSelectorMenu = await testPage.getByTestId(
          "environment-selector-dialog-item-self-hosted",
        );

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
  recordVideoConfig:
    process.env.DISABLE_VIDEO === "true"
      ? undefined
      : { dir: "tests-out/videos" },
  testOutputPath: "",
});

export const expect = test.expect;
