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
      TestNames.InlineMenuAutofill, // @TODO known failure - inline menu appears, but fails to autofill
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
      TestNames.InlineMenuAutofill, // @TODO known failure - inline menu appears, but fails to autofill
      TestNames.MessageAutofill, // @TODO known failure - fails to autofill
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
      TestNames.NewCredentialsNotification, // @TODO known failure - save prompt does not appear
      TestNames.PasswordUpdateNotification, // @TODO known failure - update prompt does not appear
    ],
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
      TestNames.NewCredentialsNotification, // @TODO known failure - save prompt does not appear
      TestNames.PasswordUpdateNotification, // @TODO known failure - update prompt does not appear
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
      password: {
        selector: "#password",
        value: "fakeLoginHoneypotPassword",
      },
    },
    skipTests: [
      TestNames.NewCredentialsNotification, // @TODO known failure - save prompt does not appear
      TestNames.PasswordUpdateNotification, // @TODO known failure - update prompt does not appear
    ],
  },
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
      TestNames.NewCredentialsNotification, // @TODO known failure - save prompt does not appear
      TestNames.PasswordUpdateNotification, // @TODO known failure - update prompt does not appear
    ],
  },
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
      TestNames.NewCredentialsNotification, // @TODO known failure - save prompt does not appear
      TestNames.PasswordUpdateNotification, // @TODO known failure - update prompt does not appear
    ],
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
      TestNames.InlineMenuAutofill, // No inline menu to test for this input // @TODO do a shouldNotHaveInlineMenu check instead
    ],
  },
  {
    url: `${testSiteHost}/forms/search/inline-search`,
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
      TestNames.InlineMenuAutofill, // No inline menu to test for this input // @TODO do a shouldNotHaveInlineMenu check instead
    ],
  },
  {
    url: `${testSiteHost}/forms/search/typeless-search`,
    inputs: {
      username: {
        shouldNotFill: true,
        selector: "input.typeless-search-input",
        value: testUserName,
      },
      password: {
        shouldNotFill: true,
        selector: "input.typeless-search-input",
        value: "fakeSearchPassword",
      },
    },
    shouldNotTriggerNotification: true,
    skipTests: [
      TestNames.InlineMenuAutofill, // No inline menu to test for this input // @TODO do a shouldNotHaveInlineMenu check instead
    ],
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
    skipTests: [
      TestNames.PasswordUpdateNotification, // @TODO need to update test design to handle this test page case (e.g. existing password should be used for the password field) // @TODO known failure - because the email is being updated, the update is seen as a new cipher, rather than an update to an existing one
      TestNames.InlineMenuAutofill, // @TODO known failure - fills new email input with attribute `autocomplete="off"`
      TestNames.MessageAutofill, // @TODO known failure - fills new email input with attribute `autocomplete="off"`
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
    skipTests: [
      TestNames.NewCredentialsNotification, // New credentials won't be used for this case
      TestNames.PasswordUpdateNotification, // @TODO need to update test design to handle this test page case (e.g. existing password should be used for the current password field)
      TestNames.InlineMenuAutofill, // @TODO known failure - fills new password inputs with attribute `autocomplete="new-password"`
      TestNames.MessageAutofill, // @TODO known failure - fills new password inputs with attribute `autocomplete="new-password"`
    ],
  },
];
