import path from "path";
import {
  debugIsActive,
  defaultGotoOptions,
  defaultNavigationTimeout,
  defaultWaitForOptions,
  screenshotsOutput,
  TestNames,
} from "../../constants";
import { test, expect } from "../fixtures.browser";
import { FillProperties } from "../../abstractions";
import { getPagesToTest, doAutofill, formatUrlToFilename } from "../utils";

test.describe("Extension autofills forms when triggered", () => {
  test("Log in to the vault, open pages, and run page tests", async ({
    background,
    extensionSetup,
  }) => {
    let testPage = await extensionSetup;
    testPage.setDefaultNavigationTimeout(defaultNavigationTimeout);

    const pagesToTest = getPagesToTest();

    for (const page of pagesToTest) {
      const { url, inputs, skipTests } = page;

      await test.step(`Autofill the form at ${url}`, async () => {
        if (skipTests?.includes(TestNames.MessageAutofill)) {
          console.log(
            "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
            `\tSkipping known failure for ${url}`,
          );

          return;
        }

        await testPage.goto(url, defaultGotoOptions);

        const inputKeys = Object.keys(inputs);
        const firstInput = inputs[inputKeys[0]];
        const firstInputPreFill = firstInput.preFillActions;
        if (firstInputPreFill) {
          try {
            await firstInputPreFill(testPage);
          } catch (error) {
            console.log(
              "\x1b[1m\x1b[31m%s\x1b[0m", // bold, red foreground
              "\tThere was a prefill error:",
              error,
            );

            if (debugIsActive) {
              await testPage.pause();
            }
          }
        }

        const firstInputSelector = firstInput.selector;
        const firstInputElement =
          typeof firstInputSelector === "string"
            ? await testPage.locator(firstInputSelector).first()
            : await firstInputSelector(testPage);
        await firstInputElement.waitFor(defaultWaitForOptions);

        await doAutofill(background);

        /* Pause a moment before capturing input values.
           (otherwise, when expecting an empty value, the test may pass before the fill,
           potentially resulting in a false positive) */
        await testPage.waitForTimeout(800);

        for (const inputKey of inputKeys) {
          const currentInput: FillProperties = inputs[inputKey];
          const currentInputSelector = currentInput.selector;
          const currentInputSelectedElement =
            typeof currentInputSelector === "string"
              ? await testPage.locator(currentInputSelector).first()
              : await currentInputSelector(testPage);

          const expectedValue = currentInput.shouldNotFill
            ? ""
            : currentInput.value;

          await expect(currentInputSelectedElement).toHaveValue(expectedValue);

          await testPage.screenshot({
            fullPage: true,
            path: path.join(
              screenshotsOutput,
              `${formatUrlToFilename(url)}-${inputKey}-autofill.png`,
            ),
          });

          const nextStepInput: FillProperties | undefined =
            currentInput.multiStepNextInputKey &&
            inputs[currentInput.multiStepNextInputKey];

          if (nextStepInput) {
            await currentInputSelectedElement.press("Enter");

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

                if (debugIsActive) {
                  await testPage.pause();
                }
              }
            }

            const nextInputSelector = nextStepInput.selector;
            const nextInputElement =
              typeof nextInputSelector === "string"
                ? await testPage.locator(nextInputSelector).first()
                : await nextInputSelector(testPage);
            await nextInputElement.waitFor(defaultWaitForOptions);

            await doAutofill(background);
          }

          if (debugIsActive) {
            await testPage.pause();
          }
        }
      });

      await test.step(`Notification should not appear when submitting the form at ${url}`, async () => {
        // Submit
        await testPage.keyboard.press("Enter");

        // Target notification close button since it's present on all notification bar cases
        const notificationBarCloseButtonLocator = testPage
          .frameLocator("#bit-notification-bar-iframe")
          .getByRole("button", { name: "Close" })
          .first();

        await expect(notificationBarCloseButtonLocator).not.toBeVisible();
      });
    }

    // Add some buffer at the end of testing so any animations/transitions have a chance to
    // complete before the recording is ended
    await testPage.waitForTimeout(2000);

    // Hold the window open (don't automatically close out) when debugging
    if (debugIsActive) {
      await testPage.pause();
    }
  });
});
