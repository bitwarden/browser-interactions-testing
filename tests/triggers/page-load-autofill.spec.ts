import {
  defaultGotoOptions,
  defaultWaitForOptions,
  TestNames,
  testPages,
  testSiteHost,
} from "../../constants";
import { test, expect } from "../fixtures.browser";
import {
  getPagesToTest,
  expectInputsAutofilled,
  expectInputsEmpty,
  waitForInput,
} from "../utils";

/*
  Autofill trigger: autofill on page load.

  Enabling the `autofillOnPageLoad` setting makes the extension autofill a matching
  form automatically on navigation, with NO explicit trigger (no message, no click).

  Causality is proven with a negative control: with the setting off the simple form
  must stay empty; only after enabling the setting do forms fill. The only change
  between the two observations is the setting, so the fill is attributable to
  page-load autofill and not to some other filler.

  Two settings gate the fill: the global toggle, and the per-login default (which
  decides ciphers whose own autofill-on-page-load is unset — the seeded ciphers'
  are). Visiting #/autofill writes the default to `false` as a side effect of the
  select initializing, so the default must be set back explicitly.
*/

const settingPropagationDelay = 1500;
const onLoadFillSettleDelay = 1500;
const simpleFormUrl = `${testSiteHost}/forms/login/simple`;

test.describe("Autofill on page load", () => {
  test("Enabling autofillOnPageLoad fills matching forms on navigation", async ({
    context,
    extensionId,
    extensionSetup,
  }) => {
    const popupPage = await extensionSetup;

    // Negative control (once): with the setting off, the simple form must NOT fill.
    // This cannot use `getPagesToTest()` because that list may not include the simple form.
    const simplePage = testPages.find(({ url }) => url === simpleFormUrl);
    if (!simplePage) {
      throw new Error(
        `Expected the simple login page (${simpleFormUrl}) in \`testPages\`.`,
      );
    }
    const baselinePage = await context.newPage();
    await baselinePage.goto(simpleFormUrl, defaultGotoOptions);
    await baselinePage.locator("#username").waitFor(defaultWaitForOptions);
    await baselinePage.waitForTimeout(onLoadFillSettleDelay);
    await expectInputsEmpty(baselinePage, simplePage.inputs);
    await baselinePage.close();

    // Enable both gating settings on the popup autofill settings page.
    await popupPage.goto(
      `chrome-extension://${extensionId}/popup/index.html#/autofill`,
      defaultGotoOptions,
    );
    const toggle = popupPage.locator("#autofillOnPageLoad");
    await toggle.waitFor(defaultWaitForOptions);
    // Assert the setting was off during the baseline above, so the control is airtight.
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expect(toggle).toBeChecked();

    // The default is an ng-select typeahead; open it and pick the "Autofill on page load" option.
    const defaultSelect = popupPage.getByLabel(
      "Default autofill setting for login items",
      {
        exact: true,
      },
    );
    await defaultSelect.click();
    await popupPage
      .getByRole("option", { name: "Autofill on page load", exact: true })
      .click();

    // Let the setting writes propagate from the popup to the service worker before a
    // fresh page load reads them at content-script injection time.
    await popupPage.waitForTimeout(settingPropagationDelay);

    // With the setting on, each eligible page fills on a fresh navigation — no trigger sent.
    for (const page of getPagesToTest()) {
      const { url, inputs, skipTests } = page;

      await test.step(`autofill on page load at ${url}`, async () => {
        if (skipTests?.includes(TestNames.PageLoadAutofill)) {
          console.log(
            "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
            `\tSkipping ${url}`,
          );

          return;
        }

        const formPage = await context.newPage();
        const firstInput = inputs[Object.keys(inputs)[0]];

        // Run the first input's setup, if any, before navigation — e.g. registering the
        // handler that accepts the cross-frame fill dialog — so it is in place when the
        // on-load fill fires.
        await firstInput.preFillActions?.(formPage);

        await formPage.goto(url, defaultGotoOptions);
        await waitForInput(formPage, firstInput);

        // Give the on-load content-script fill a moment before reading values.
        await formPage.waitForTimeout(onLoadFillSettleDelay);
        await expectInputsAutofilled(formPage, inputs);

        await formPage.close();
      });
    }
  });
});
