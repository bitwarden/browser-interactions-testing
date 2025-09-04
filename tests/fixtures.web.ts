import {
  test as base,
  chromium,
  Page,
  type BrowserContext,
} from "@playwright/test";
import { configDotenv } from "dotenv";

import {
  defaultGotoOptions,
  defaultWaitForOptions,
  vaultEmail,
  vaultPassword,
  vaultHostURL,
} from "../constants";

configDotenv({ quiet: true });

export const test = base.extend<{
  context: BrowserContext;
  webClientSetup: Page;
}>({
  context: async ({ browser }, use) => {
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
        "--disable-blink-features=AutomationControlled", // navigator.webdriver = false
        "--enable-automation=false", // This flag disables the password manager
      ],
      // Help mitigate automation detection with a known-good userAgent
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      slowMo: 600,
      viewport: {
        width: 1200,
        height: 1000,
      },
      recordVideo:
        process.env.DISABLE_VIDEO === "true"
          ? undefined
          : { dir: "tests-out/videos" },
    });

    await Promise.all([
      context.setDefaultTimeout(20000),
      context.setDefaultNavigationTimeout(120000),
    ]);

    await use(context);
  },
  webClientSetup: async ({ context }, use) => {
    let testPage: Page;

    let contextPages = await context.pages();
    testPage = contextPages[0];

    await test.step("Log in to the web vault", async () => {
      await testPage.goto(`${vaultHostURL}/#/login`, defaultGotoOptions);

      const emailInput = await testPage.getByLabel("Email address");
      await emailInput.waitFor(defaultWaitForOptions);
      await emailInput.fill(vaultEmail);
      const emailSubmitInput = await testPage.getByRole("button");
      await emailSubmitInput.click();

      const masterPasswordInput = await testPage.getByLabel("Master password");
      await masterPasswordInput.waitFor(defaultWaitForOptions);
      await masterPasswordInput.fill(vaultPassword);

      const loginButton = await testPage.getByRole("button", {
        name: "Log in with master password",
      });
      await loginButton.waitFor(defaultWaitForOptions);
      await loginButton.click();

      const vaultURL = `${vaultHostURL}/#/vault`;
      await testPage.waitForURL(vaultURL, defaultGotoOptions);
      const vaultFilterBox = await testPage.locator("app-vault-items");
      await vaultFilterBox.waitFor(defaultWaitForOptions);
    });

    await use(testPage);
  },
});

export const expect = test.expect;
