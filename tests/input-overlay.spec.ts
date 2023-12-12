import { Page } from "@playwright/test";
import path from "path";
import {
  debugIsActive,
  defaultGotoOptions,
  defaultWaitForOptions,
  overlayPages,
  testSiteHost,
  vaultEmail,
  vaultHostURL,
  vaultPassword,
} from "./constants";
import { test, expect } from "./fixtures";
import { FillProperties } from "../abstractions";
import { getPagesToTest } from "./utils";

export const screenshotsOutput = path.join(__dirname, "../screenshots");

let testPage: Page;

test.describe("Extension presents page input overlay with options for vault interaction", () => {
  test("Log in to the vault, open pages, and autofill forms", async ({
    context,
    extensionId,
  }) => {
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
            `environment_configured-input_overlay_tests.png`,
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

    const pagesToTest = getPagesToTest(overlayPages);

    test.setTimeout(480000);
    testPage.setDefaultNavigationTimeout(60000);

    for (const page of pagesToTest) {
      const { url, inputs } = page;
      const isLocalPage = url.startsWith(testSiteHost);

      await test.step(`Fill the form via overlay and submit at ${url}`, async () => {
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

        // Navigate overlay for autofill
        await firstInputElement.focus();
        await testPage.keyboard.press("ArrowDown");
        await testPage.keyboard.press("Space");

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
              `${url}-${inputKey}-overlay.png`,
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

            // Navigate overlay for autofill
            await nextInputElement.focus();
            await testPage.keyboard.press("ArrowDown");
            await testPage.keyboard.press("Space");
          }

          if (debugIsActive) {
            await testPage.pause();
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
