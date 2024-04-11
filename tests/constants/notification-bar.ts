import {
  CipherType,
  NotificationPageTest,
  UriMatchType,
} from "../../abstractions";
import { testSiteHost } from "./server";
import { testUserName, testEmail } from "./settings";

export const testPages: NotificationPageTest[] = [
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
    url: `${testSiteHost}/forms/login/input-constraints-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: { selector: "#email", value: testEmail },
      password: {
        selector: "#password",
        value: "123456",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/search/simple-search`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        selector: "#search",
        value: testUserName,
      },
      password: {
        selector: "#search",
        value: "fakeSearchPassword",
      },
    },
    shouldNotTriggerNotification: true,
  },
];

// Known failure cases; expected to fail
export const knownFailureCases: NotificationPageTest[] = [
  {
    // @TODO works, but need to add seeding ciphers with multiple URIs for the correct behaviour
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-login/`,
    // @TODO support multiple URIs
    // `${testSiteHost}/login-page-bare`
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
    actions: {
      submit: async (page) =>
        await page
          .frameLocator("#test-iframe")
          .getByRole("button", { name: "Login", exact: true })
          .click(),
    },
  },
  {
    // @TODO works, but need to add seeding ciphers with multiple URIs for the correct behaviour
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-sandboxed-login`,
    // @TODO support multiple URIs
    // `${testSiteHost}/login-page-bare`
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
    actions: {
      submit: async (page) =>
        await page
          .frameLocator("#test-iframe")
          .getByRole("button", { name: "Login", exact: true })
          .click(),
    },
  },
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
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/bare-inputs-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: { selector: "#username", value: testUserName },
      password: { selector: "#password", value: "fakeBareInputsPassword" },
    },
    actions: {
      submit: async (page) =>
        await page.getByRole("button", { name: "Login", exact: true }).click(),
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/shadow-root-inputs`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        selector: async (page) => await page.getByLabel("Username"),
        value: testUserName,
      },
      password: {
        selector: async (page) => await page.getByLabel("Password"),
        value: "fakeShadowRootInputsPassword",
      },
    },
    actions: {
      submit: async (page) =>
        await page.getByRole("button", { name: "Login", exact: true }).click(),
    },
  },
];
