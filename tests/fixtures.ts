import path from "path";
import fs from "fs";
import {
  test as base,
  chromium,
  Page,
  type BrowserContext,
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
  context: BrowserContext;
  extensionId: string;
  extensionSetup: Page;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
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
      recordVideo: { dir: "tests-out/videos" },
    });

    await Promise.all([
      context.setDefaultTimeout(20000),
      context.setDefaultNavigationTimeout(120000),
    ]);

    await use(context);
  },
  extensionId: async ({ context }, use) => {
    let background;
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pathToExtension, "manifest.json"), "utf8"),
    );

    if (manifest?.manifest_version === 3) {
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

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
  extensionSetup: async ({ context, extensionId }, use) => {
    let testPage: Page;

    await test.step("Close the extension welcome page when it pops up", async () => {
      // Wait for the extension to open the welcome page before continuing
      if (!debugIsActive) {
        await context.waitForEvent("page");
      }

      let contextPages = await context.pages();

      // close all but the first tab
      await Promise.all(
        contextPages.slice(1).map((contextPage) => contextPage.close()),
      );

      testPage = contextPages[0];

      if (debugIsActive) {
        console.log(
          (await testPage.evaluate(() => navigator.userAgent)) + "\n",
        );
      }
    });

    await test.step("Configure the environment", async () => {
      if (vaultHostURL) {
        const extensionURL = `chrome-extension://${extensionId}/popup/index.html?uilocation=popout#/environment`;
        await testPage.goto(extensionURL, defaultGotoOptions);
        const baseUrlInput = await testPage.locator("input#baseUrl");
        await baseUrlInput.waitFor(defaultWaitForOptions);

        await testPage.fill("input#baseUrl", vaultHostURL);

        await testPage.screenshot({
          fullPage: true,
          path: path.join(
            screenshotsOutput,
            "environment_configured-autofill_tests.png",
          ),
        });

        const serverConfigContent = await testPage.locator("#baseUrlHelp");
        await testPage.click("button[type='submit']");
        await serverConfigContent.waitFor({
          ...defaultWaitForOptions,
          state: "detached",
        });
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

      const masterPasswordInput = await testPage.locator(
        "input#masterPassword",
      );
      await masterPasswordInput.waitFor(defaultWaitForOptions);
      await masterPasswordInput.fill(vaultPassword);

      const loginButton = await testPage.getByRole("button", {
        name: "Log in with master password",
      });
      await loginButton.waitFor(defaultWaitForOptions);
      await loginButton.click();

      const extensionURL = `chrome-extension://${extensionId}/popup/index.html?uilocation=popout#/tabs/vault`;
      await testPage.waitForURL(extensionURL, defaultGotoOptions);
      const vaultFilterBox = await testPage
        .locator("app-vault-filter main .box.list")
        .first();
      await vaultFilterBox.waitFor(defaultWaitForOptions);
    });

    await use(testPage);
  },
});

export const expect = test.expect;
