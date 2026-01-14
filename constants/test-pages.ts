import { PageTest } from "../abstractions";
import { testSiteHost } from "./server";
import { testUserName, testEmail } from "./settings";

export const TestNames = {
  /** Tests an password generation action from an appropriate inline menu selection. */
  InlineMenuPasswordGen: "inlineMenuPasswordGen",
  /** Tests an autofill action from an appropriate inline menu selection. */
  InlineMenuAutofill: "inlineMenuAutofill",
  /** Tests a "blind", or contextless autofill action; extension logic determines which cipher to use. */
  MessageAutofill: "messageAutofill",
  /** Tests that a notification for _adding_ a new login cipher to the vault has appeared appropriately. */
  NewCredentialsNotification: "newCredentialsNotification",
  /** Tests that a notification for _updating_ a new login cipher to the vault has appeared appropriately. */
  PasswordUpdateNotification: "passwordUpdateNotification",
} as const;

/**
  Test pages and instructions for interactions

  Notes:
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
      TestNames.InlineMenuAutofill, // @TODO known failure - test case works manually; Playwright has difficulty targeting
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
      TestNames.InlineMenuAutofill, // @TODO known failure - test case works manually; Playwright has difficulty targeting
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
      TestNames.MessageAutofill, // @TODO known failure - due to `value` input/expected value conflation
      TestNames.NewCredentialsNotification, // @TODO known failure - local testing succeeds; only fails in CI mode - due to `value` input/expected value conflation
      TestNames.PasswordUpdateNotification, // @TODO known failure - save prompt appears instead of update prompt - due to `value` input/expected value conflation
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
        shouldNotAutofill: true,
        skipSimulatedUserValueEntry: true,
        value: "fakeLoginHoneypotCode",
      },
      newPassword: {
        selector: "input[name='honeypotPassword']",
        shouldNotAutofill: true,
        skipSimulatedUserValueEntry: true,
        value: "fakeLoginHoneypotPassword",
      },
      email: {
        selector: "input[name='honeypotEmail']",
        shouldNotAutofill: true,
        skipSimulatedUserValueEntry: true,
        value: "fakeLoginHoneypotEmail",
      },
      password: {
        selector: "#password",
        value: "fakeLoginHoneypotPassword",
      },
    },
    skipTests: [],
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
      TestNames.MessageAutofill, // @TODO known failure - notification appears inappropriately - due to `value` input/expected value conflation
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
      TestNames.InlineMenuAutofill, // @TODO known failure - test case works manually; Playwright has difficulty targeting
      TestNames.MessageAutofill, // Identity card cipher autofill requires its own configured shortcut keys
      TestNames.NewCredentialsNotification, // No new cipher notification available for this type of cipher (PM-8699)
      TestNames.PasswordUpdateNotification, // No update notification available for this type of cipher (PM-8699)
    ],
  },
  {
    url: `${testSiteHost}/forms/payment/card-payment`,
    inputs: {
      cardholderName: { selector: "#card-name", value: "John Smith" },
      // @TODO test cases where there is input for card brand/type
      number: { selector: "#card-number", value: "4111111111111111" },
      // @TODO handle inputs that enforce different and/or non-concatenated date formats
      expMonth: { selector: "#card-expiration", value: "12/25" },
      code: { selector: "#card-cvv", value: "123" },
    },
    skipTests: [
      TestNames.MessageAutofill, // Contextless card cipher autofill requires its own configured shortcut keys
      TestNames.NewCredentialsNotification, // No new cipher notification available for this type of cipher (PM-8699)
      TestNames.PasswordUpdateNotification, // No update notification available for this type of cipher (PM-8699)
    ],
  },
  {
    url: `${testSiteHost}/forms/search/simple-search`,
    inputs: {
      username: {
        shouldNotAutofill: true,
        shouldNotHaveInlineMenu: true,
        selector: "#search",
        value: testUserName,
      },
      password: {
        shouldNotAutofill: true,
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
        shouldNotAutofill: true,
        shouldNotHaveInlineMenu: true,
        selector: "#search",
        value: testUserName,
      },
      password: {
        shouldNotAutofill: true,
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
        shouldNotAutofill: true,
        shouldNotHaveInlineMenu: true,
        // Note, we're targeting the search field which should have no inline menu
        selector: "input.typeless-search-input",
        value: testUserName,
      },
      password: {
        shouldNotAutofill: true,
        selector: "input.typeless-search-input",
        value: "fakeSearchPassword",
      },
    },
    actions: {
      submit: async (page) =>
        await page.getByRole("button", { name: "Go", exact: true }).click(),
    },
    shouldNotTriggerNewNotification: true,
    shouldNotTriggerUpdateNotification: true,
    skipTests: [],
  },
  {
    url: `${testSiteHost}/forms/update/update-email`,
    inputs: {
      username: {
        shouldNotAutofill: true,
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
      TestNames.InlineMenuAutofill, // @TODO known failure - need to update test design to handle this test page case (e.g. existing ciphers should appear for password input, any existing identity ciphers for new email input)
      TestNames.MessageAutofill, // @TODO known failure - fills new email input with existing email (PM-26477)
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
        shouldNotAutofill: true,
        selector: "#newPassword",
        value: "newFakeUpdatePasswordPagePassword",
      },
      newPasswordRetype: {
        shouldNotAutofill: true,
        selector: "#newPasswordRetype",
        value: "newFakeUpdatePasswordPagePassword",
      },
    },
    shouldNotTriggerNewNotification: true,
    skipTests: [
      TestNames.MessageAutofill, // @TODO known failure - fills new password inputs with attribute `autocomplete="new-password"` (PM-26477)
    ],
  },
];
