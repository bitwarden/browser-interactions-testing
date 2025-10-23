import { Page, TestInfo, Worker } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  debugIsActive,
  defaultGotoOptions,
  messageColor,
  startFromTestUrl,
  testPages,
  violationColor,
} from "../constants";
import { testPages as publicTestPages } from "../constants/public";

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

export async function doAutofill(background: Page | Worker) {
  await background.evaluate(() =>
    chrome.tabs.query({ active: true }, (tabs) => {
      if (tabs[0]) {
        return chrome.tabs.sendMessage(tabs[0]?.id || 0, {
          command: "collectPageDetails",
          tab: tabs[0],
          sender: "autofill_cmd",
        });
      }
    }),
  );
}

export function formatUrlToFilename(urlString: string) {
  return urlString.replace(/[^a-z\d]/gi, "-");
}

export async function getNotificationFrame(page: Page, extensionId: string) {
  const expectedAddressStart = `chrome-extension://${extensionId}/notification/bar.html`;

  let notificationFrame = page
    .frames()
    .find((frame) => frame.url().startsWith(expectedAddressStart));

  if (!notificationFrame) {
    notificationFrame = await page.waitForEvent("frameattached", {
      timeout: 5_000,
      predicate: (frame) => frame.url().startsWith(expectedAddressStart),
    });
  }

  await notificationFrame.waitForLoadState("domcontentloaded");
  return notificationFrame;
}

export async function getNotificationElements(
  page: Page,
  extensionId: string,
  testId: string,
) {
  const notificationLocator = await getNotificationFrame(page, extensionId);
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
