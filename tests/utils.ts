import { Page, TestInfo, Worker, Frame, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  debugIsActive,
  defaultGotoOptions,
  defaultWaitForOptions,
  messageColor,
  startFromTestUrl,
  testPages,
  violationColor,
} from "../constants";
import { testPages as publicTestPages } from "../constants/public";
import { FillProperties, PageTest } from "../abstractions";
import { AutofillCommand } from "../enums";

export function getPagesToTest(usePublicTestPages: boolean = false) {
  const filteredPageTests = usePublicTestPages ? publicTestPages : testPages;

  // When debug is active, only run tests against `onlyTest` pages if any are specified
  if (debugIsActive) {
    const onlyTestPages = filteredPageTests.filter(({ onlyTest }) => onlyTest);

    if (onlyTestPages.length) {
      return onlyTestPages;
    }
  }

  if (startFromTestUrl) {
    const startTestIndex = filteredPageTests.findIndex(
      ({ url }) => url === startFromTestUrl,
    );

    return startTestIndex > 0
      ? filteredPageTests.slice(startTestIndex)
      : filteredPageTests;
  }

  return filteredPageTests;
}

/** Maps a page's `AutofillCommand` to the extension command sender that routes the
    autofill to the matching cipher type. */
export const autofillCommandSender = {
  [AutofillCommand.Login]: "autofill_cmd",
  [AutofillCommand.Card]: "autofill_card",
  [AutofillCommand.Identity]: "autofill_identity",
} as const satisfies Record<AutofillCommand, string>;

export type AutofillCommandSender =
  (typeof autofillCommandSender)[keyof typeof autofillCommandSender];

export async function doAutofill(
  background: Page | Worker,
  sender: AutofillCommandSender = autofillCommandSender[AutofillCommand.Login],
) {
  await background.evaluate(
    (sender) =>
      chrome.tabs.query({ active: true }, (tabs) => {
        if (tabs[0]) {
          return chrome.tabs.sendMessage(tabs[0]?.id || 0, {
            command: "collectPageDetails",
            tab: tabs[0],
            sender,
          });
        }
      }),
    sender,
  );
}

export function formatUrlToFilename(urlString: string) {
  return urlString.replace(/[^a-z\d]/gi, "-");
}

/** Resolve a page input's selector to a Locator. */
export async function resolveInputLocator(page: Page, input: FillProperties) {
  return typeof input.selector === "string"
    ? page.locator(input.selector).first()
    : await input.selector(page);
}

/** Resolve an input and wait for it to be present. Text-mode mirrors (`verifyAccessor: "text"`)
    have no rendered size until autofill populates them, so wait for attachment, not visibility. */
export async function waitForInput(page: Page, input: FillProperties) {
  const element = await resolveInputLocator(page, input);
  await element.waitFor(
    input.verifyAccessor === "text"
      ? { ...defaultWaitForOptions, state: "attached" }
      : defaultWaitForOptions,
  );
  return element;
}

/** The trigger suites cover only single-step forms (multi-step pages are skipped). Enforce that
    precondition in code so a multi-step page reaching verification without a trigger skip fails
    loudly here rather than silently mis-verifying its later-step fields. */
function assertSingleStepForm(inputs: PageTest["inputs"]) {
  for (const inputKey of Object.keys(inputs)) {
    if (inputs[inputKey].multiStepNextInputKey) {
      throw new Error(
        `Trigger autofill verification does not support multi-step forms (input "${inputKey}"). ` +
          "Add a TestNames.PageLoadAutofill / PopupAutofill skip for this page.",
      );
    }
  }
}

/**
 * Assert every input on a page holds its expected autofilled value (empty when
 * `shouldNotAutofill`). Used by the trigger suites, which cover only single-step forms
 * (multi-step pages are skipped), so this does not walk `multiStepNextInputKey`.
 */
export async function expectInputsAutofilled(
  page: Page,
  inputs: PageTest["inputs"],
) {
  assertSingleStepForm(inputs);
  for (const inputKey of Object.keys(inputs)) {
    const input: FillProperties = inputs[inputKey];
    const element = await resolveInputLocator(page, input);
    const expectedValue = input.shouldNotAutofill ? "" : input.value;

    if (input.verifyAccessor === "text") {
      await expect(element).toHaveText(expectedValue);
    } else {
      await expect(element).toHaveValue(expectedValue);
    }
  }
}

/** Assert every input on a page is empty — the false-positive guard the trigger suites
    run before initiating a fill. */
export async function expectInputsEmpty(
  page: Page,
  inputs: PageTest["inputs"],
) {
  assertSingleStepForm(inputs);
  for (const inputKey of Object.keys(inputs)) {
    const input: FillProperties = inputs[inputKey];
    const element = await resolveInputLocator(page, input);

    if (input.verifyAccessor === "text") {
      await expect(element).toHaveText("");
    } else {
      await expect(element).toHaveValue("");
    }
  }
}

export async function getNotificationFrame(
  page: Page,
  extensionId: string,
  shouldNotTrigger: boolean = false,
) {
  const expectedAddressStart = `chrome-extension://${extensionId}/notification/bar.html`;

  let notificationFrame = page
    .frames()
    .find((frame) => frame.url().startsWith(expectedAddressStart));

  if (!notificationFrame && !shouldNotTrigger) {
    return await page.waitForEvent("frameattached", {
      predicate: (frame) => frame.url().startsWith(expectedAddressStart),
    });
  }

  if (notificationFrame) {
    await notificationFrame.waitForLoadState("domcontentloaded");
  }
  return notificationFrame;
}

export async function getNotificationElements(
  notificationLocator: Frame | null,
  testId: string,
  page: Page,
) {
  if (!notificationLocator) {
    return {
      notificationLocator: null,
      newCipherNotificationLocator: page.getByTestId(testId),
      updatePasswordNotificationLocator: page.getByTestId(testId),
      notificationCloseButtonLocator: page.getByRole("button", {
        name: "Close",
      }),
    };
  }

  const notificationElement = notificationLocator.getByTestId(testId);
  const notificationCloseButtonLocator = notificationLocator.getByRole(
    "button",
    {
      name: "Close",
    },
  );

  return {
    notificationLocator,
    newCipherNotificationLocator: notificationElement,
    updatePasswordNotificationLocator: notificationElement,
    notificationCloseButtonLocator,
  };
}

export async function a11yTestView({
  testInfo,
  testPage,
  urlBase,
  urlSharedPathBase,
  viewPath,
}: {
  testInfo: TestInfo;
  testPage: Page;
  urlBase: string;
  urlSharedPathBase: string;
  viewPath: string;
}): Promise<number> {
  let violationsCount = 0;

  const isBrowserClient = urlBase.startsWith("chrome-extension://");
  const viewUrl = `${urlBase}${viewPath}`;

  await testPage.goto(viewUrl, defaultGotoOptions);

  const accessibilityScanResults = await new AxeBuilder({
    page: testPage,
  })
    .options({
      resultTypes: ["violations"],
      absolutePaths: true,
      selectors: true,
      iframes: true,
    })
    .analyze();

  const scanResultsSuffix = encodeURIComponent(
    isBrowserClient ? `browser-client_${viewPath}` : viewUrl,
  );
  await testInfo.attach(`a11y-scan-results_${scanResultsSuffix}`, {
    body: JSON.stringify(accessibilityScanResults, null, 2),
    contentType: "application/json",
  });

  let annotationMessages: string[][] = [];

  for (const violation of accessibilityScanResults.violations) {
    violationsCount += violation.nodes.length;

    for (const violatingNode of violation.nodes) {
      const logColor = violatingNode.impact
        ? violationColor[violatingNode.impact]
        : "";

      // Some hacky whitespace formatting for shared spacing between stout and markdown-reporter
      const annotationMessage = [
        `${violatingNode.impact} issue(s) found with \`${viewPath}\` view nodes:\n`,
        `  \`${violatingNode.target[0].toLocaleString()}\`\n`,
        `  ${violatingNode.failureSummary.replaceAll("\n", "\n\n      ")}\n`,
      ];

      annotationMessages = [...annotationMessages, annotationMessage];

      console.log(logColor, `     ${annotationMessage[0]}`);
      console.log(
        messageColor.boldForeground,
        `     ${annotationMessage[1]}\n`,
        `     ${annotationMessage[2]}`,
      );
    }
  }

  if (violationsCount) {
    await testInfo.annotations.push({
      type: `issue`,
      description: `${violationsCount} a11y violations found for \`${urlSharedPathBase + viewPath}\``,
    });

    await annotationMessages.forEach(async (violationMessage) => {
      await testInfo.annotations.push({
        type: `issue-details`,
        description: violationMessage.join("\n  "),
      });
    });
  }

  return violationsCount;
}
