import {
  AutofillTestPage,
  NotificationTestPage,
  CipherType,
} from "../abstractions";
import {
  debugIsActive,
  startFromTestUrl,
  targetTestPages,
  testSiteHost,
} from "./constants";

export function getNotificationPagesToTest(
  notificationPageTests: NotificationTestPage[],
) {
  return getPagesToTest(notificationPageTests) as NotificationTestPage[];
}

export function getPagesToTest(
  pageTests: AutofillTestPage[] | NotificationTestPage[],
) {
  const filteredPageTests = pageTests.filter(({ cipherType, url }) => {
    // @TODO additional work needed for non-login ciphers
    if (cipherType !== CipherType.Login) {
      return false;
    }

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
