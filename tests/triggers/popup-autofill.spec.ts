import {
  defaultGotoOptions,
  defaultWaitForOptions,
  TestNames,
} from "../../constants";
import { test, expect } from "../fixtures.browser";
import {
  getPagesToTest,
  expectInputsAutofilled,
  expectInputsEmpty,
  waitForInput,
} from "../utils";

/*
  Autofill trigger: popup vault-item click.

  Clicking a vault item's fill affordance in the extension popup autofills the active
  web page. The popup normally fills the *active* tab in the current window; opened as
  a Playwright tab that would be the popup itself, so the fill would short-circuit. The
  product's single-action popout passes a `senderTabId` query param — read via Angular's
  hash-routed `queryParams`, i.e. AFTER the hash — to target the originating tab instead.
  This test uses that same seam.
*/

const FILL_SETTLE_DELAY = 800;

test.describe("Popup vault-item click triggers autofill", () => {
  test("Clicking Fill in the popup autofills matching forms", async ({
    context,
    background,
    extensionId,
    extensionSetup,
  }) => {
    // extensionSetup logs in so the extension session is unlocked.
    await extensionSetup;

    for (const page of getPagesToTest()) {
      const { url, inputs, skipTests } = page;

      await test.step(`popup autofill at ${url}`, async () => {
        if (skipTests?.includes(TestNames.PopupAutofill)) {
          console.log(
            "\x1b[1m\x1b[33m%s\x1b[0m", // bold, yellow foreground
            `\tSkipping ${url}`,
          );

          return;
        }

        // Open the target web form in its own tab — this is the real fill target.
        const formPage = await context.newPage();
        await formPage.goto(url, defaultGotoOptions);
        const firstInput = inputs[Object.keys(inputs)[0]];
        await waitForInput(formPage, firstInput);

        // Run the first input's setup, if any, before triggering the fill — e.g. registering
        // the handler that accepts the cross-frame fill dialog on iframe pages.
        await firstInput.preFillActions?.(formPage);

        // Resolve the chrome tab id of the form tab via the service worker.
        const formTabId = await background.evaluate(async (formUrl) => {
          const tabs = await chrome.tabs.query({});
          return tabs.find((tab) => tab.url?.startsWith(formUrl))?.id;
        }, url);
        expect(formTabId, "form tab id should resolve").toBeTruthy();

        // Open the popup as a fresh document pointed at the form tab via the product's
        // single-action `senderTabId` param (read by Angular's hash-routed queryParams,
        // so it sits AFTER the hash). A fresh page guarantees Angular boots with the param.
        const popupPage = await context.newPage();
        await popupPage.goto(
          `chrome-extension://${extensionId}/popup/index.html#/tabs/vault?senderTabId=${formTabId}`,
          defaultGotoOptions,
        );

        // The URI-matched cipher appears under "Autofill suggestions". Scope to the
        // matched item's row so the item asserted present is the one clicked. The fill
        // control is either a badge/chip (aria-label "Autofill - <name>") or, under the
        // simplified-item-action flag, a hover "Fill" text button; both live in
        // the row and call doAutofill().
        const pathname = new URL(url).pathname;
        const suggestionItem = popupPage
          .locator("app-autofill-vault-list-items")
          .locator("bit-item")
          .filter({ hasText: pathname });
        await suggestionItem.waitFor(defaultWaitForOptions);

        const fillBadge = suggestionItem.getByRole("button", {
          name: /^Autofill - /,
        });
        const fillHover = suggestionItem.getByRole("button", {
          name: "Fill",
          exact: true,
        });

        // False-positive guard: the fields must be empty before the click, so a
        // boot-time or page-load fill can't produce a false positive.
        await expectInputsEmpty(formPage, inputs);

        await fillBadge.or(fillHover).first().click();

        // Let the fill land before reading values, so empty-expected inputs can't pass early.
        await formPage.waitForTimeout(FILL_SETTLE_DELAY);

        // The popup click autofilled the web form.
        await expectInputsAutofilled(formPage, inputs);

        await popupPage.close();
        await formPage.close();
      });
    }
  });
});
