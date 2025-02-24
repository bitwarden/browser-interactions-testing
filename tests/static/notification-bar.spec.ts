import path from "path";
import {
  defaultGotoOptions,
  defaultNavigationTimeout,
  defaultWaitForOptions,
  screenshotsOutput,
  TestNames,
} from "../../constants";
import { test, expect } from "../fixtures.browser";
import { FillProperties } from "../../abstractions";
import { getPagesToTest, formatUrlToFilename } from "../utils";

const testOutputPath = "notification-bar";
let testRetryCount = 0;

// Notification bar tests are currently flaky, so give them an extra retry
test.describe.configure({
  retries: process.env.CI && process.env.DISABLE_RETRY !== "true" ? 2 : 0,
});

test.describe("Extension triggers a notification bar when a page form is submitted with non-stored values", () => {
  test.use({
    recordVideoConfig: process.env.DISABLE_VIDEO !== "true" && {
      dir: `tests-out/videos/${testOutputPath}`,
    },
    testOutputPath,
  });

  test("Log in to the vault, open pages, and run page tests", async ({
    extensionId,
    extensionSetup,
  }, testInfo) => {
    if (testInfo.retry > testRetryCount) {
      testRetryCount = testInfo.retry;
    }

    let testPage = await extensionSetup;
    testPage.setDefaultNavigationTimeout(defaultNavigationTimeout);

    // Needed to allow the background reload further down
    await test.step("Set vault to never timeout", async () => {
      const extensionAutofillSettingsURL = `chrome-extension://${extensionId}/popup/index.html?uilocation=popout#/account-security`;
      await testPage.goto(extensionAutofillSettingsURL, defaultGotoOptions);
      const timeoutOptionsInput = await testPage.getByLabel("Timeout", {
        exact: true,
      });
      await timeoutOptionsInput.fill("Never");
      await timeoutOptionsInput.press("Enter");
      await testPage.getByRole("button", { name: "Yes" }).click();
    });

    const pagesToTest = getPagesToTest();

    for (const page of pagesToTest) {
      const {
        url,
        inputs,
        actions,
        shouldNotTriggerNewNotification,
        shouldNotTriggerUpdateNotification,
        skipTests,
      } = page;

      await test.step(`fill the form with non-stored credentials at ${url}`, async () => {
        if (skipTests?.includes(TestNames.NewCredentialsNotification)) {
          console.log(
            "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
            `\tSkipping known failure for ${url}`,
          );

          return;
        }

        await testPage.goto(url, defaultGotoOptions);

        // @TODO workaround for content script not being ready
        await testPage.waitForTimeout(1000);

        const inputKeys = Object.keys(inputs);

        for (const inputKey of inputKeys) {
          const currentInput: FillProperties = inputs[inputKey];

          if (currentInput?.preFillActions) {
            try {
              await currentInput.preFillActions(testPage);
            } catch (error) {
              console.log(
                "\x1b[1m\x1b[31m%s\x1b[0m", // bold, red foreground
                "\tThere was a prefill error:",
                error,
              );
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
                console.log(
                  "\x1b[1m\x1b[31m%s\x1b[0m", // bold, red foreground
                  "\tThere was a prefill error:",
                  error,
                );
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

        await test.step(`the new cipher notification bar should ${shouldNotTriggerNewNotification ? "NOT " : ""}appear when submitting the form`, async () => {
          // Submit
          if (actions?.submit) {
            await actions.submit(testPage);
          } else {
            await testPage.keyboard.press("Enter");
          }

          // Wait for form submit redirect
          await testPage.waitForLoadState();

          await testPage.screenshot({
            fullPage: true,
            path: path.join(
              screenshotsOutput,
              `${formatUrlToFilename(url)}-notification-new-cipher-attempt-${testRetryCount + 1}.png`,
            ),
          });

          const notificationBarLocator = await testPage.frameLocator(
            "#bit-notification-bar-iframe",
          );

          const newCipherNotificationBarLocator =
            notificationBarLocator.getByText(
              "Should Bitwarden remember this password for you?",
            );

          const notificationBarCloseButtonLocator =
            notificationBarLocator.getByRole("button", { name: "Close" });

          if (shouldNotTriggerNewNotification) {
            // Target the notification close button since it's present on all notification bar cases
            await expect(notificationBarCloseButtonLocator).not.toBeVisible();
          } else {
            // Ensure the correct type of notification appears
            await expect(newCipherNotificationBarLocator).toBeVisible();

            // Close the notification bar for the next triggering case
            await notificationBarCloseButtonLocator.click();

            await expect(notificationBarCloseButtonLocator).not.toBeVisible();
          }
        });
      });

      await test.step(`fill the form with a stored username/email and a non-stored password at ${url}`, async () => {
        if (skipTests?.includes(TestNames.PasswordUpdateNotification)) {
          console.log(
            "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
            `\tSkipping known failure for ${url}`,
          );

          return;
        }

        await testPage.goto(url, defaultGotoOptions);

        // @TODO workaround for content script not being ready
        await testPage.waitForTimeout(1000);

        const inputKeys = Object.keys(inputs);

        for (const inputKey of inputKeys) {
          const currentInput: FillProperties = inputs[inputKey];

          if (currentInput?.preFillActions) {
            try {
              await currentInput.preFillActions(testPage);
            } catch (error) {
              console.log(
                "\x1b[1m\x1b[31m%s\x1b[0m", // bold, red foreground
                "\tThere was a prefill error:",
                error,
              );
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
                console.log(
                  "\x1b[1m\x1b[31m%s\x1b[0m", // bold, red foreground
                  "\tThere was a prefill error:",
                  error,
                );
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

        await test.step(`the update password notification bar should ${shouldNotTriggerUpdateNotification ? "NOT " : ""}appear when submitting the form`, async () => {
          // Submit
          if (actions?.submit) {
            await actions.submit(testPage);
          } else {
            await testPage.keyboard.press("Enter");
          }

          // Wait for form submit redirect
          await testPage.waitForLoadState();

          await testPage.screenshot({
            fullPage: true,
            path: path.join(
              screenshotsOutput,
              `${formatUrlToFilename(url)}-notification-update-cipher-attempt-${testRetryCount + 1}.png`,
            ),
          });

          const notificationBarLocator = await testPage.frameLocator(
            "#bit-notification-bar-iframe",
          );

          const updatePasswordNotificationBarLocator =
            notificationBarLocator.getByText(
              "Do you want to update this password in Bitwarden?",
            );

          const notificationBarCloseButtonLocator =
            notificationBarLocator.getByRole("button", { name: "Close" });

          if (shouldNotTriggerUpdateNotification) {
            // Target the notification close button since it's present on all notification bar cases
            await expect(notificationBarCloseButtonLocator).not.toBeVisible();
          } else {
            // Ensure the correct type of notification appears
            await expect(updatePasswordNotificationBarLocator).toBeVisible();

            // Close the notification bar for the next triggering case
            await notificationBarCloseButtonLocator.click();

            await expect(notificationBarCloseButtonLocator).not.toBeVisible();
          }
        });
      });
    }

    // Add some buffer at the end of testing so any animations/transitions have a chance to
    // complete before the recording is ended
    await testPage.waitForTimeout(2000);
  });
});
