import { Page } from "@playwright/test";
import path from "path";
import { testSiteHost, notificationPages } from "./constants";
import { test, expect } from "./fixtures";
import {
  FillProperties,
  LocatorWaitForOptions,
  PageGoToOptions,
} from "../abstractions";

export const screenshotsOutput = path.join(__dirname, "../screenshots");

let testPage: Page;

const vaultEmail = process.env.VAULT_EMAIL || "";
const vaultPassword = process.env.VAULT_PASSWORD || "";
const vaultHostURL = process.env.VAULT_HOST_URL;
const startFromTestUrl = process.env.START_FROM_TEST_URL || null;
const targetTestPages = process.env.TARGET;
const debugIsActive = ["1", "console"].includes(process.env.PWDEBUG);
const defaultGotoOptions: PageGoToOptions = {
  waitUntil: "domcontentloaded",
  timeout: 60000,
};
const defaultWaitForOptions: LocatorWaitForOptions = {
  state: "visible",
  timeout: 15000,
};

test.describe("Extension autofills forms when triggered", () => {
  test("Log in to the vault, open pages, and autofill forms", async ({
    context,
    extensionId,
  }) => {
    await Promise.all([
      context.setDefaultTimeout(20000),
      context.setDefaultNavigationTimeout(120000),
    ]);

    const [backgroundPage] = context.backgroundPages();

    await test.step("Close the extension welcome page when it pops up", async () => {
      await context.waitForEvent("page");

      let contextPages = context.pages();
      expect(contextPages.length).toBe(2);

      const welcomePage = contextPages[1];
      if (welcomePage) {
        await welcomePage.close();
      }

      testPage = contextPages[0];

      if (debugIsActive) {
        console.log(
          (await testPage.evaluate(() => navigator.userAgent)) + "\n"
        );
      }
    });

    await test.step("Configure the environment", async () => {
      // @TODO check for and fill other settings
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
            `environment_configured-notification_bar_tests.png`
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
        "input#masterPassword"
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

    let pagesToTest =
      targetTestPages === "static"
        ? notificationPages.filter(({ url }) => url.startsWith(testSiteHost))
        : targetTestPages === "public"
        ? notificationPages.filter(({ url }) => !url.startsWith(testSiteHost))
        : notificationPages;

    if (debugIsActive) {
      const onlyTestPages = pagesToTest.filter(({ onlyTest }) => onlyTest);

      if (onlyTestPages.length) {
        pagesToTest = onlyTestPages;
      }
    }

    if (startFromTestUrl) {
      const startTestIndex = pagesToTest.findIndex(
        ({ url }) => url === startFromTestUrl
      );

      pagesToTest =
        startTestIndex > 0 ? pagesToTest.slice(startTestIndex) : pagesToTest;
    }

    test.setTimeout(480000);
    testPage.setDefaultNavigationTimeout(60000);

    for (const page of pagesToTest) {
      const { url, inputs } = page;
      const isLocalPage = url.startsWith(testSiteHost);

      await test.step(`Fill and submit the form at ${url}`, async () => {
        await testPage.goto(url, defaultGotoOptions);

        // @TODO workaround for flaky background loading
        await backgroundPage.reload();

        const inputKeys = Object.keys(inputs);

        for (const inputKey of inputKeys) {
          const currentInput: FillProperties = inputs[inputKey];

          if (currentInput?.preFillActions) {
            try {
              await currentInput.preFillActions(testPage);
            } catch (error) {
              console.log("There was a prefill error:", error);
            }
          }

          const currentInputSelector = currentInput.selector;
          const currentInputElement =
            typeof currentInputSelector === "string"
              ? await testPage.locator(currentInputSelector).first()
              : await currentInputSelector(testPage);

          const expectedValue = currentInput.value;

          currentInputElement.fill(expectedValue);

          // Do not soft expect on local test pages; we want to stop the tests before hitting live pages
          if (isLocalPage) {
            await expect(currentInputElement).toHaveValue(expectedValue);
          } else {
            await expect.soft(currentInputElement).toHaveValue(expectedValue);
          }

          await testPage.screenshot({
            fullPage: true,
            path: path.join(
              screenshotsOutput,
              `${url}-${inputKey}-notification.png`
            ),
          });

          const nextStepInput: FillProperties | undefined =
            currentInput.multiStepNextInputKey &&
            inputs[currentInput.multiStepNextInputKey];

          if (nextStepInput) {
            await currentInputElement.press("Enter");

            const nextInputPreFill = nextStepInput.preFillActions;
            if (nextInputPreFill) {
              try {
                await nextInputPreFill(testPage);
              } catch (error) {
                console.log("There was a prefill error:", error);
              }
            }

            const nextInputSelector = nextStepInput.selector;
            const nextInputElement =
              typeof nextInputSelector === "string"
                ? await testPage.locator(nextInputSelector).first()
                : await nextInputSelector(testPage);
            await nextInputElement.waitFor(defaultWaitForOptions);
          }

          if (inputKey === inputKeys.slice(-1)[0]) {
            if (debugIsActive) {
              await testPage.pause();
            }

            // Submit
            await testPage.waitForTimeout(600);
            await currentInputElement.press("Enter");

            const notificationBar = await testPage
              .frameLocator("#bit-notification-bar-iframe")
              .getByText("Should Bitwarden remember")
              .first();
            await notificationBar.waitFor(defaultWaitForOptions);

            expect(notificationBar).toBeVisible();

            // Close the notification bar for the next triggering case
            await testPage
              .frameLocator("#bit-notification-bar-iframe")
              .getByRole("button", { name: "Close" })
              .click();
          }
        }
      });
    }

    // Hold the window open (don't automatically close out) when debugging
    if (debugIsActive) {
      await testPage.pause();
    }
  });
});
