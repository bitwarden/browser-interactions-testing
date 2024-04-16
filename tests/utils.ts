import { Page } from "@playwright/test";
import { debugIsActive, startFromTestUrl, testPages } from "../constants";
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

export async function doAutofill(backgroundPage: Page) {
  await backgroundPage.evaluate(() =>
    chrome.tabs.query(
      { active: true },
      (tabs) =>
        tabs[0] &&
        chrome.tabs.sendMessage(tabs[0]?.id || 0, {
          command: "collectPageDetails",
          tab: tabs[0],
          sender: "autofill_cmd",
        }),
    ),
  );
}

export function formatUrlToFilename(urlString: string) {
  return urlString.replace(/[^a-z\d]/gi, "-");
}
