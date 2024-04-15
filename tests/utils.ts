import { Page } from "@playwright/test";
import { PageTest } from "../abstractions/test-pages";
import {
  debugIsActive,
  startFromTestUrl,
  targetTestPages,
  testSiteHost,
} from "./constants";

export function getPagesToTest(pageTests: PageTest[]) {
  const filteredPageTests = pageTests.filter(({ url }) => {
    if (targetTestPages === "static") {
      return url.startsWith(testSiteHost);
    } else if (targetTestPages === "public") {
      return !url.startsWith(testSiteHost);
    } else {
      return true;
    }
  });

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
