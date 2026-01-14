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
const testOutputPath = "inline-menu-password-gen";
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
    context,
  }, testInfo) => {
    // Used for checking inline menu "No items" content
    context.grantPermissions(["clipboard-write", "clipboard-read"]);

    if (testInfo.retry > testRetryCount) {
      testRetryCount = testInfo.retry;
    }

    let testPage = await extensionSetup;
    testPage.setDefaultNavigationTimeout(defaultNavigationTimeout);

    const pagesToTest = getPagesToTest();

    // Helper function to determine if an input is a password field
    const isPasswordField = (inputKey: string): boolean => {
      return (
        inputKey === "password" ||
        inputKey === "newPassword" ||
        inputKey === "newPasswordRetype"
      );
    };

    for (const page of pagesToTest) {
      const { url, inputs, skipTests } = page;

      await test.step(`generate and fill a new password at ${url}`, async () => {
        if (skipTests?.includes(TestNames.InlineMenuPasswordGen)) {
          console.log(
            "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
            `\tSkipping known failure for ${url}`,
          );

          return;
        }

        await testPage.goto(url, defaultGotoOptions);

        const inputKeys = Object.keys(inputs);

        for (const inputKey of inputKeys) {
          const currentInput: FillProperties = inputs[inputKey];

          // Execute pre-fill actions if they exist
          const currentInputPreFill = currentInput.preFillActions;
          if (currentInputPreFill) {
            try {
              await currentInputPreFill(testPage);
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

          const currentInputSelector = currentInput.selector;
          const currentInputElement =
            typeof currentInputSelector === "string"
              ? await testPage.locator(currentInputSelector).first()
              : await currentInputSelector(testPage);
          // await currentInputElement.waitFor(defaultWaitForOptions);
          // console.log('🚀 🚀 currentInputElement:', currentInputElement);

          // Focus the target input for the inline menu to appear
          await currentInputElement.click();
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

          // a) Check if inline menu appears when it should/shouldn't
          if (currentInput.shouldNotHaveInlineMenu) {
            expect(
              inlineMenu,
              `inline menu should NOT appear for ${inputKey} input`,
            ).toBe(null);

            continue; // Skip to next input
          } else {
            expect(
              inlineMenu,
              `inline menu should appear for ${inputKey} input`,
            ).not.toBe(null);
          }

          const initialInputValue = await currentInputElement.inputValue();
          expect(
            initialInputValue,
            `${inputKey} field should have no value`,
          ).toBe("");

          const isPassword = isPasswordField(inputKey);

          if (isPassword) {
            // The text in the password generator inline menu is unselectable,
            // so we have to infer its type by its behaviour.
            await testPage.keyboard.press("ArrowDown");
            await testPage.keyboard.press("Space");

            // Wait for the password to be generated and filled
            await testPage.waitForTimeout(500);

            const newValue = await currentInputElement.inputValue();

            expect(
              newValue.length,
              `${inputKey} field should have a generated value after triggering the action`,
            ).toBeGreaterThan(0);
          } else {
            // @TODO this is fragile and only coincidentally works for this case
            // Because Playwright cannot pierce closed shadowroots, we're
            // selecting and copying the contents of the inline menu with
            // the clipboard
            // await inlineMenu.click(':root', {clickCount: 3, delay: 10, button: 'left',  position: {x: 3, y: 3}});
            await testPage.keyboard.press("ArrowDown");
            await testPage.keyboard.press("ControlOrMeta+A");
            await testPage.keyboard.press("ControlOrMeta+C");

            let clipboardText = await testPage.evaluate(async () => {
              return await navigator.clipboard.readText();
            });
            console.log("🚀 🚀 clipboardText:", clipboardText);
            // await testPage.pause();
            await expect(
              clipboardText,
              `non-password field ${inputKey} should show "No items to show" message`,
            ).toContain("No items to show");
            await expect(
              clipboardText,
              `non-password field ${inputKey} should show "New login" message`,
            ).toContain("New login");
          }

          await testPage.screenshot({
            fullPage: true,
            path: path.join(
              screenshotsOutput,
              `${formatUrlToFilename(url)}-${inputKey}-inline_menu-attempt-${testRetryCount + 1}.png`,
            ),
          });

          // Input needs to be unfocused to allow subsequent clicks to dispatch to
          // potentially obscured inputs
          await currentInputElement.blur();
          await testPage
            .locator("body")
            .click({ button: "left", position: { x: 0, y: 0 } });
        }

        if (debugIsActive) {
          await testPage.pause();
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
