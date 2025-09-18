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
    - input `value` properties are used by autofill tests to represent expected values, and by other tests as values to be entered ( @TODO separate these concerns )
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
      TestNames.InlineMenuAutofill, // @TODO known failure - inline menu appears, but fails to autofill (PM-8704)
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
      TestNames.InlineMenuAutofill, // @TODO known failure - inline menu appears, but fails to autofill (PM-8693)
      TestNames.MessageAutofill, // @TODO known failure - fails to autofill (PM-8693)
      TestNames.NewCredentialsNotification, // @TODO known failure - regression (PM-19363)
      TestNames.PasswordUpdateNotification, // @TODO known failure - regression (PM-19363)
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
    skipTests: [],
  },
  {
    url: `${testSiteHost}/forms/login/hidden-login`,
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Click button to display form step
          await page
            .getByRole("button", { name: "Show login", exact: true })
            .click();
        },
        multiStepNextInputKey: "email",
        selector: "#username",
        value: testUserName,
      },
      email: {
        multiStepNextInputKey: "password",
        selector: "#email",
        value: testEmail,
      },
      password: {
        selector: "#password",
        value: "fakeHiddenFormPassword",
      },
    },
    skipTests: [
      TestNames.MessageAutofill, // @TODO known failure - notification appears inappropriately (PM-19376)
      TestNames.PasswordUpdateNotification, // @TODO known failure - save prompt appears instead of update prompt
    ],
  },
  {
    url: `${testSiteHost}/forms/login/input-constraints-login`,
    inputs: {
      username: {
        selector: "#email",
        value: testEmail,
      },
      password: {
        selector: "#password",
        value: "123456",
      },
    },
  },
  {
    url: `${testSiteHost}/forms/login/login-honeypot`,
    inputs: {
      username: {
        selector: "#username",
        value: testUserName,
      },
      code: {
        selector: "input[name='honeypotCode']",
        shouldNotFill: true,
        skipSimulatedUserValueEntry: true,
        value: "fakeLoginHoneypotCode",
      },
      newPassword: {
        selector: "input[name='honeypotPassword']",
        shouldNotFill: true,
        skipSimulatedUserValueEntry: true,
        value: "fakeLoginHoneypotPassword",
      },
      email: {
        selector: "input[name='honeypotEmail']",
        shouldNotFill: true,
        skipSimulatedUserValueEntry: true,
        value: "fakeLoginHoneypotEmail",
      },
      password: {
        selector: "#password",
        value: "fakeLoginHoneypotPassword",
      },
    },
    skipTests: [
      TestNames.InlineMenuAutofill, // @TODO known failure - inline menu fills "honeypotPassword" honeypot input (PM-8695)
    ],
  },
  {
    url: `${testSiteHost}/forms/multi-step/email-username-login`,
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
      TestNames.MessageAutofill, // @TODO known failure - notification appears inappropriately (PM-19376)
      TestNames.NewCredentialsNotification, // @TODO known failure - save prompt does not appear (PM-8697)
      TestNames.PasswordUpdateNotification, // @TODO known failure - update prompt does not appear (PM-8697)
    ],
  },
  // @TODO add test for /forms/create/security-code-multi-input
  // (Note, TOTP autofill is a Premium subscription feature)
  // @TODO known failure - auto-fill fails to correctly fill multi-input TOTP entry (PM-8703)
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
    skipTests: [],
  },
  // @TODO add test for /forms/create/create-account
  // @TODO add test for /forms/create/create-account-extended/
  // Card and Identity Ciphers currently cannot be autofilled through the same mechanism that Login Ciphers are. This is because of how we handle messaging for autofilling login items. The extension will need to be updated to handle these types of Ciphers.
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
      TestNames.NewCredentialsNotification, // No new cipher notification available for this type of cipher (PM-8699)
      TestNames.PasswordUpdateNotification, // No update notification available for this type of cipher (PM-8699)
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
      TestNames.NewCredentialsNotification, // No new cipher notification available for this type of cipher (PM-8699)
      TestNames.PasswordUpdateNotification, // No update notification available for this type of cipher (PM-8699)
    ],
  },
  {
    url: `${testSiteHost}/forms/search/simple-search`,
    inputs: {
      username: {
        shouldNotFill: true,
        shouldNotHaveInlineMenu: true,
        selector: "#search",
        value: testUserName,
      },
      password: {
        shouldNotFill: true,
        selector: "#search",
        value: "fakeSearchPassword",
      },
    },
    shouldNotTriggerNewNotification: true,
    shouldNotTriggerUpdateNotification: true,
    skipTests: [],
  },
  {
    url: `${testSiteHost}/forms/search/inline-search`,
    inputs: {
      username: {
        shouldNotFill: true,
        shouldNotHaveInlineMenu: true,
        selector: "#search",
        value: testUserName,
      },
      password: {
        shouldNotFill: true,
        shouldNotHaveInlineMenu: true,
        selector: "#search",
        value: "fakeSearchPassword",
      },
    },
    shouldNotTriggerNewNotification: true,
    shouldNotTriggerUpdateNotification: true,
    skipTests: [],
  },
  {
    url: `${testSiteHost}/forms/search/typeless-search`,
    inputs: {
      username: {
        shouldNotFill: true,
        shouldNotHaveInlineMenu: true,
        // Note, we're targeting the search field which should have no inline menu
        selector: "input.typeless-search-input",
        value: testUserName,
      },
      password: {
        shouldNotFill: true,
        selector: "input.typeless-search-input",
        value: "fakeSearchPassword",
      },
    },
    shouldNotTriggerNewNotification: true,
    shouldNotTriggerUpdateNotification: true,
    skipTests: [],
  },
  {
    url: `${testSiteHost}/forms/update/update-email`,
    inputs: {
      username: {
        shouldNotFill: true,
        selector: "#email",
        value: "new" + testEmail,
      },
      password: {
        selector: "#password",
        value: "fakeUpdateEmailPagePassword",
      },
    },
    shouldNotTriggerNewNotification: true,
    skipTests: [
      TestNames.NewCredentialsNotification, // @TODO need to update test design to handle this test page case (e.g. existing password should be used for the password field) // @TODO known failure - because the email is being updated, the update is seen as a new cipher, rather than an update to an existing one (PM-8700)
      TestNames.PasswordUpdateNotification, // @TODO need to update test design to handle this test page case (e.g. existing password should be used for the password field) // @TODO known failure - because the email is being updated, the update is seen as a new cipher, rather than an update to an existing one (PM-8700)
      TestNames.InlineMenuAutofill, // @TODO known failure - fills new email input with attribute `autocomplete="off"` (PM-8701)
      TestNames.MessageAutofill, // @TODO known failure - fills new email input with attribute `autocomplete="off"` (PM-8701)
    ],
  },
  {
    url: `${testSiteHost}/forms/update/update-password`,
    inputs: {
      password: {
        selector: "#currentPassword",
        value: "fakeUpdatePasswordPagePassword",
      },
      newPassword: {
        shouldNotFill: true,
        selector: "#newPassword",
        value: "newFakeUpdatePasswordPagePassword",
      },
      newPasswordRetype: {
        shouldNotFill: true,
        selector: "#newPasswordRetype",
        value: "newFakeUpdatePasswordPagePassword",
      },
    },
    shouldNotTriggerNewNotification: true,
    skipTests: [
      TestNames.InlineMenuAutofill, // @TODO known failure - fills new password inputs with attribute `autocomplete="new-password"` (PM-8701)
      TestNames.MessageAutofill, // @TODO known failure - fills new password inputs with attribute `autocomplete="new-password"` (PM-8701)
    ],
  },
];
