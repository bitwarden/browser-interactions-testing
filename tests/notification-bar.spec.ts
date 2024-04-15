import { Page } from "@playwright/test";
import path from "path";
import {
  debugIsActive,
  defaultGotoOptions,
  defaultWaitForOptions,
  testPages,
  testSiteHost,
  vaultEmail,
  vaultHostURL,
  vaultPassword,
  TestNames,
} from "../constants";
import { test, expect } from "./fixtures";
import { FillProperties } from "../abstractions";
import { getPagesToTest, formatUrlToFilename } from "./utils";

export const screenshotsOutput = path.join(__dirname, "../screenshots");

let testPage: Page;

test.describe("Extension triggers a notification bar when a page form is submitted with non-stored values", () => {
  test("Log in to the vault, open pages, and run page tests", async ({
    context,
    extensionId,
  }) => {
    const [backgroundPage] = context.backgroundPages();

    await test.step("Close the extension welcome page when it pops up", async () => {
      // Wait for the extension to open the welcome page before continuing
      await context.waitForEvent("page");

      let contextPages = await context.pages();
      expect(contextPages.length).toBe(2);

      const welcomePage = contextPages[1];
      if (welcomePage) {
        await welcomePage.close();
      }

      testPage = contextPages[0];

      if (debugIsActive) {
        console.log(
          (await testPage.evaluate(() => navigator.userAgent)) + "\n",
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
            "environment_configured-notification_bar_tests.png",
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

    // Needed to allow the background reload further down
    await test.step("Set vault to never timeout", async () => {
      const extensionAutofillSettingsURL = `chrome-extension://${extensionId}/popup/index.html?uilocation=popout#/tabs/settings`;
      await testPage.goto(extensionAutofillSettingsURL, defaultGotoOptions);
      await testPage
        .getByLabel("Vault timeout", { exact: true })
        .selectOption("9: null");
      await testPage.getByRole("button", { name: "Yes" }).click();
    });

    const pagesToTest = getPagesToTest(testPages);

    test.setTimeout(480000);
    testPage.setDefaultNavigationTimeout(60000);

    for (const page of pagesToTest) {
      const { url, inputs, actions, shouldNotTriggerNotification, skipTests } =
        page;
      const isLocalPage = url.startsWith(testSiteHost);

      if (!isLocalPage) {
        console.log(
          "notification bar tests cannot be run against public sites",
          // ...because they require a submit, which we don't want to do on live sites
        );

        return;
      }

      await test.step(`fill the form with non-stored credentials at ${url}`, async () => {
        if (skipTests?.includes(TestNames.NewCredentialsNotification)) {
          console.log(`Skipping known failure for ${url}`);

          return;
        }

        await testPage.goto(url, defaultGotoOptions);

        // @TODO workaround for extension not handling popstate events
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

          // Use new input values to trigger the notification bar prompt
          let expectedValue = `new+${currentInput.value}`;

          // Only use new input password values to trigger the notification bar update prompt
          if (inputKey === "password") {
            // Only rearrange value to ensure value will fit length constraints
            expectedValue = currentInput.value.split("").reverse().join("");
          }

          currentInputElement.fill(expectedValue);

          await expect(currentInputElement).toHaveValue(expectedValue);

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
        }

        await test.step(`the new cipher notification bar should ${shouldNotTriggerNotification ? "NOT " : ""}appear when submitting the form`, async () => {
          // Submit
          if (actions?.submit) {
            await actions.submit(testPage);
          } else {
            await testPage.keyboard.press("Enter");
          }

          await testPage.screenshot({
            fullPage: true,
            path: path.join(
              screenshotsOutput,
              `${formatUrlToFilename(url)}-notification-new-cipher.png`,
            ),
          });

          const newCipherNotificationBarLocator = testPage
            .frameLocator("#bit-notification-bar-iframe")
            .getByText("Should Bitwarden remember this password for you?");

          const notificationBarCloseButtonLocator = testPage
            .frameLocator("#bit-notification-bar-iframe")
            .getByRole("button", { name: "Close" });

          if (shouldNotTriggerNotification) {
            // Target the notification close button since it's present on all notification bar cases
            await expect(notificationBarCloseButtonLocator).not.toBeVisible();
          } else {
            // Ensure the correct type of notification appears
            await expect(newCipherNotificationBarLocator).toBeVisible();

            // Close the notification bar for the next triggering case
            await notificationBarCloseButtonLocator.click();
          }
        });
      });

      await test.step(`fill the form with a stored username/email and a non-stored password at ${url}`, async () => {
        if (skipTests?.includes(TestNames.PasswordUpdateNotification)) {
          console.log(`Skipping known failure for ${url}`);

          return;
        }

        await testPage.goto(url, defaultGotoOptions);

        // @TODO workaround for extension not handling popstate events
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

          let expectedValue = currentInput.value;

          // Only use new input password values to trigger the notification bar update prompt
          if (inputKey === "password") {
            // Only rearrange value to ensure value will fit length constraints
            expectedValue = currentInput.value.split("").reverse().join("");
          }

          currentInputElement.fill(expectedValue);

          await expect(currentInputElement).toHaveValue(expectedValue);

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
        }

        await test.step(`the update password notification bar should ${shouldNotTriggerNotification ? "NOT " : ""}appear when submitting the form`, async () => {
          // Submit
          if (actions?.submit) {
            await actions.submit(testPage);
          } else {
            await testPage.keyboard.press("Enter");
          }

          await testPage.screenshot({
            fullPage: true,
            path: path.join(
              screenshotsOutput,
              `${formatUrlToFilename(url)}-notification-update-cipher.png`,
            ),
          });

          const updatePasswordNotificationBarLocator = testPage
            .frameLocator("#bit-notification-bar-iframe")
            .getByText("Do you want to update this password in Bitwarden?");

          const notificationBarCloseButtonLocator = testPage
            .frameLocator("#bit-notification-bar-iframe")
            .getByRole("button", { name: "Close" });

          if (shouldNotTriggerNotification) {
            // Target the notification close button since it's present on all notification bar cases
            await expect(notificationBarCloseButtonLocator).not.toBeVisible();
          } else {
            // Ensure the correct type of notification appears
            await expect(updatePasswordNotificationBarLocator).toBeVisible();

            // Close the notification bar for the next triggering case
            await notificationBarCloseButtonLocator.click();
          }
        });
      });
    }
  });
});
