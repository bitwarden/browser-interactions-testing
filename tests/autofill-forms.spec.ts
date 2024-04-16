import path from "path";
import {
  debugIsActive,
  defaultGotoOptions,
  defaultNavigationTimeout,
  defaultTestTimeout,
  defaultWaitForOptions,
  screenshotsOutput,
  TestNames,
  testPages,
  testSiteHost,
} from "../constants";
import { test, expect } from "./fixtures";
import { FillProperties } from "../abstractions";
import { getPagesToTest, doAutofill, formatUrlToFilename } from "./utils";

test.describe("Extension autofills forms when triggered", () => {
  test("Log in to the vault, open pages, and run page tests", async ({
    context,
    extensionSetup,
  }) => {
    test.setTimeout(defaultTestTimeout);

    let testPage = await extensionSetup;
    testPage.setDefaultNavigationTimeout(defaultNavigationTimeout);

    const [backgroundPage] = context.backgroundPages();
    const pagesToTest = getPagesToTest(testPages);

    for (const page of pagesToTest) {
      const { url, inputs, skipTests } = page;
      const isLocalPage = url.startsWith(testSiteHost);

      await test.step(`Autofill the form at ${url}`, async () => {
        if (skipTests?.includes(TestNames.MessageAutofill)) {
          console.log(`Skipping known failure for ${url}`);

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
            console.log("There was a prefill error:", error);

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

        await doAutofill(backgroundPage);

        for (const inputKey of inputKeys) {
          const currentInput: FillProperties = inputs[inputKey];
          const currentInputSelector = currentInput.selector;
          const currentInputElement =
            typeof currentInputSelector === "string"
              ? await testPage.locator(currentInputSelector).first()
              : await currentInputSelector(testPage);

          const expectedValue = currentInput.shouldNotFill
            ? ""
            : currentInput.value;

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
              `${formatUrlToFilename(url)}-${inputKey}-autofill.png`,
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

            await doAutofill(backgroundPage);
          }

          if (debugIsActive) {
            await testPage.pause();
          }
        }
      });

      // Skip form submission check for public sites
      if (isLocalPage) {
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
    }

    // Hold the window open (don't automatically close out) when debugging
    if (debugIsActive) {
      await testPage.pause();
    }
  });
});
