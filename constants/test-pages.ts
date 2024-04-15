import { PageTest } from "../abstractions";
import { testSiteHost } from "./server";
import { testUserName, testEmail } from "./settings";

export const TestNames = {
  InlineMenuAutofill: "inlineMenuAutofill",
  MessageAutofill: "messageAutofill",
  NewCredentialsNotification: "newCredentialsNotification",
  PasswordUpdateNotification: "passwordUpdateNotification",
} as const;

/*
  Test pages and instructions for interactions

  Notes:
    - input `value` properties are used by autofill tests to represent expected values, and by other tests as values to be entered
    - properties prefixed with `shouldNot` are representations of expected behaviour, not known failures
*/
export const testPages: PageTest[] = [
  {
    url: `${testSiteHost}/forms/login/simple`,
    inputs: {
      username: { selector: "#username", value: testUserName },
      password: { selector: "#password", value: "fakeBasicFormPassword" },
    },
  },
  {
    url: `${testSiteHost}/forms/login/iframe-login`,
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Accept the iframe fill prompt
          await page.on("dialog", (dialog) => dialog.accept());
        },
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
    skipTests: [
      TestNames.InlineMenuAutofill, // @TODO known failure
      TestNames.MessageAutofill, // @TODO known failure
      TestNames.PasswordUpdateNotification, // @TODO known failure
    ],
  },
  {
    url: `${testSiteHost}/forms/login/iframe-sandboxed-login`,
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Accept the iframe fill prompt
          await page.on("dialog", (dialog) => dialog.accept());
        },
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
    skipTests: [
      TestNames.InlineMenuAutofill, // @TODO known failure
      TestNames.MessageAutofill, // @TODO known failure
      TestNames.PasswordUpdateNotification, // @TODO known failure
    ],
  },
  {
    url: `${testSiteHost}/forms/login/bare-inputs-login`,
    inputs: {
      username: { selector: "#username", value: testUserName },
      password: { selector: "#password", value: "fakeBareInputsPassword" },
    },
    actions: {
      submit: async (page) =>
        await page.getByRole("button", { name: "Login", exact: true }).click(),
    },
    skipTests: [
      TestNames.NewCredentialsNotification, // @TODO known failure
      TestNames.PasswordUpdateNotification, // @TODO known failure
    ],
  },
  // @TODO add test for /forms/login/hidden-login
  {
    url: `${testSiteHost}/forms/login/input-constraints-login`,
    inputs: {
      username: { selector: "#email", value: testEmail },
      password: {
        selector: "#password",
        value: "123456",
      },
    },
  },
  // @TODO add test for /forms/login/login-honeypot
  {
    url: `${testSiteHost}/forms/login/multi-step-login`,
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
    skipTests: [
      TestNames.NewCredentialsNotification, // @TODO known failure
      TestNames.PasswordUpdateNotification, // @TODO known failure
    ],
  },
  // @TODO add test for /forms/login/security-code-multi-input
  {
    url: `${testSiteHost}/forms/login/shadow-root-inputs`,
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
    skipTests: [
      TestNames.NewCredentialsNotification, // @TODO known failure
      TestNames.PasswordUpdateNotification, // @TODO known failure
    ],
  },
  // @TODO add test for /forms/create/create-account
  // Card and Identity Ciphers currently cannot be autofilled through the same mechanism that Login Ciphers are. This is because of how we handle messaging the background for autofilling login items. The extension will need to be updated to handle these types of Ciphers.
  {
    url: `${testSiteHost}/forms/identity/address-na`,
    inputs: {
      // @TODO handle cases where there is a single name input (e.g. "full name")
      firstName: { selector: "#full-name", value: "John" },
      middleName: { selector: "#full-name", value: "M" },
      lastName: { selector: "#full-name", value: "Smith" },
      address1: { selector: "#address", value: "123 Main St" },
      address2: { selector: "#address-ext", value: "Apt 1" },
      city: { selector: "#city", value: "New York" },
      state: { selector: "#state", value: "NY" },
      postalCode: { selector: "#postcode", value: "10001" },
      country: { selector: "#country", value: "USA" },
    },
    skipTests: [
      TestNames.InlineMenuAutofill, // No autofill available for this type of cipher
      TestNames.MessageAutofill, // No autofill available for this type of cipher
      TestNames.NewCredentialsNotification, // No new cipher notification available for this type of cipher
      TestNames.PasswordUpdateNotification, // No update notification available for this type of cipher
    ],
  },
  {
    url: `${testSiteHost}/forms/payment/card-payment`,
    inputs: {
      cardholderName: { selector: "#card-name", value: "John Smith" },
      // @TODO handle cases where there is no input for card brand/type
      brand: { selector: "#card-number", value: "Visa" },
      number: { selector: "#card-number", value: "4111111111111111" },
      // @TODO handle inputs that enforce different and/or concatenated date formats
      expMonth: { selector: "#card-expiration", value: "12" },
      expYear: { selector: "#card-expiration", value: "2025" },
      code: { selector: "#card-cvv", value: "123" },
    },
    skipTests: [
      TestNames.InlineMenuAutofill, // No autofill available for this type of cipher
      TestNames.MessageAutofill, // No autofill available for this type of cipher
      TestNames.NewCredentialsNotification, // No new cipher notification available for this type of
      TestNames.PasswordUpdateNotification, // No update notification available for this type of cipher
    ],
  },
  {
    url: `${testSiteHost}/forms/search/simple-search`,
    inputs: {
      username: {
        shouldNotFill: true,
        selector: "#search",
        value: testUserName,
      },
      password: {
        shouldNotFill: true,
        selector: "#search",
        value: "fakeSearchPassword",
      },
    },
    shouldNotTriggerNotification: true,
    skipTests: [
      TestNames.InlineMenuAutofill, // No inline menu to test for this input
    ],
  },
  // @TODO add test for /forms/search/inline-search
  // @TODO add test for /forms/search/typeless-search
  // @TODO add test for /forms/update/update-email
  // @TODO add test for /forms/update/update-password
];
