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
import { getPagesToTest, formatUrlToFilename } from "../utils";

const inlineMenuAppearanceDelay = 800;
const testOutputPath = "inline-menu-autofill";
let testRetryCount = 0;

test.describe("Extension presents page input inline menu with options for vault interaction", () => {
  test.use({
    recordVideoConfig: process.env.DISABLE_VIDEO !== "true" && {
      dir: `tests-out/videos/${testOutputPath}`,
    },
    testOutputPath,
  });

  test("Log in to the vault, open pages, and run page tests", async ({
    extensionSetup,
    extensionId,
  }, testInfo) => {
    if (testInfo.retry > testRetryCount) {
      testRetryCount = testInfo.retry;
    }

    let testPage = await extensionSetup;
    testPage.setDefaultNavigationTimeout(defaultNavigationTimeout);

    const pagesToTest = getPagesToTest();

    for (const page of pagesToTest) {
      const { url, inputs, skipTests } = page;

      await test.step(`fill the form via inline menu and submit at ${url}`, async () => {
        if (skipTests?.includes(TestNames.InlineMenuAutofill)) {
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

        // Focus the target input for the inline menu to appear
        await firstInputElement.click();
        await testPage.waitForTimeout(inlineMenuAppearanceDelay);

        // returns `null` if no match is found
        let inlineMenu = await testPage.frame({
          url: `chrome-extension://${extensionId}/overlay/button.html`,
        });

        if (!inlineMenu) {
          inlineMenu = await testPage.frame({
            // If feature flag "inline-menu-positioning-improvements" is active
            url: `chrome-extension://${extensionId}/overlay/menu.html`,
          });
        }

        // Check if inline menu appears when it should/shouldn't
        if (firstInput.shouldNotHaveInlineMenu) {
          expect(
            inlineMenu,
            "an inline menu should NOT appear for the target input",
          ).toBe(null);

          // return early since we can't initiate autofill
          return;
        } else {
          expect(
            inlineMenu,
            "as inline menu should appear for the target input",
          ).not.toBe(null);
        }

        // Navigate inline menu for autofill
        await testPage.keyboard.press("ArrowDown");
        await testPage.keyboard.press("Space");

        for (const inputKey of inputKeys) {
          const currentInput: FillProperties = inputs[inputKey];
          const currentInputSelector = currentInput.selector;
          const currentInputSelectedElement =
            typeof currentInputSelector === "string"
              ? await testPage.locator(currentInputSelector).first()
              : await currentInputSelector(testPage);

          const expectedValue = currentInput.shouldNotAutofill
            ? ""
            : currentInput.value;

          await expect(currentInputSelectedElement).toHaveValue(expectedValue);

          await testPage.screenshot({
            fullPage: true,
            path: path.join(
              screenshotsOutput,
              `${formatUrlToFilename(url)}-${inputKey}-inline_menu-attempt-${testRetryCount + 1}.png`,
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

            // Navigate inline menu for autofill
            await nextInputElement.click();
            await testPage.waitForTimeout(inlineMenuAppearanceDelay);
            await testPage.keyboard.press("ArrowDown");
            await testPage.keyboard.press("Space");
          }

          if (debugIsActive) {
            await testPage.pause();
          }
        }
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
