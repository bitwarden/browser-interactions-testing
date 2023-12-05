import { CipherType, UriMatchType } from "../../abstractions";
import { TestPage } from "../../abstractions/test-pages";
import { testSiteHost } from "./server";

const testUserName = "bwplaywright";
const testEmail = "bwplaywright@example.com";

export const testPages: TestPage[] = [
  /**
   * Local webpages
   */
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/simple/`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: { selector: "#username", value: testUserName },
      password: { selector: "#password", value: "fakeBasicFormPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-login/`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        selector: async (page) =>
          await page.frameLocator("#test-iframe").locator("#username"),
        value: testUserName,
      },
      password: {
        selector: async (page) =>
          await page.frameLocator("#test-iframe").locator("#password"),
        value: "fakeIframeBasicFormPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-sandboxed-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        selector: async (page) =>
          await page.frameLocator("#test-iframe").locator("#username"),
        value: testUserName,
      },
      password: {
        selector: async (page) =>
          await page.frameLocator("#test-iframe").locator("#password"),
        value: "fakeSandboxedIframeBasicFormPassword",
      },
    },
  },
];

// Known failure cases; expected to fail
export const knownFailureCases: TestPage[] = [
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/multi-step-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        multiStepNextInputKey: "email",
        selector: "#username",
        value: testUserName,
      },
      email: {
        multiStepNextInputKey: "password",
        selector: "#email",
        value: testEmail,
      },
      password: { selector: "#password", value: "fakeMultiStepPassword" },
    },
  },
];
