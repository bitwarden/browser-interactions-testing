import { PageCipher } from "../abstractions";
import { testSiteHost } from "./server";
import {
  testUserName,
  testEmail,
  testUserEmail,
  testTotpSeed,
} from "./settings";

export const CipherType = {
  Login: 1,
  SecureNote: 2,
  Card: 3,
  Identity: 4,
} as const;

export const UriMatchType = {
  Domain: 0,
  Host: 1,
  StartsWith: 2,
  Exact: 3,
  RegularExpression: 4,
  Never: 5,
} as const;

/*
  Ciphers to seed the vault with

  Notes:
    - field property `name` refers to the custom field selector used to find the input on the page
    - fields `username` and `password` (and other predefined field types) do not have selector/`name` attributes (as they otherwise have find/fill logic defined)
*/

// Ciphers for the locally hosted test site
export const pageCiphers: PageCipher[] = [
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/simple`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testUserName },
      password: { value: "fakeBasicFormPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-login`,
    additionalLoginUrls: [`${testSiteHost}/login-page-bare`],
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeIframeBasicFormPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-sandboxed-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeSandboxedIframeBasicFormPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/bare-inputs-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testUserName },
      password: { value: "fakeBareInputsPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/hidden-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testUserName },
      email: { name: "email", value: testEmail },
      password: { value: "fakeHiddenFormPassword" },
    },
  },

  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/input-constraints-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testEmail },
      password: {
        value: "123456",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/login-honeypot`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testUserName },
      password: { value: "fakeLoginHoneypotPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/multi-step-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      email: {
        name: "email",
        value: testEmail,
      },
      password: { value: "fakeMultiStepPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/security-code-multi-input`,
    uriMatchType: UriMatchType.StartsWith,
    totpSecret: testTotpSeed + "security-code-multi-input",
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/shadow-root-inputs`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeShadowRootInputsPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/create/create-account`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testEmail,
      },
      password: {
        value: "fakeCreateAccountPagePassword",
      },
    },
  },
  {
    cipherType: CipherType.Identity,
    url: `${testSiteHost}/forms/identity/address-na`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      firstName: { value: "John" },
      middleName: { value: "M" },
      lastName: { value: "Smith" },
      address1: { value: "123 Main St" },
      address2: { value: "Apt 1" },
      city: { value: "New York" },
      state: { value: "NY" },
      postalCode: { value: "10001" },
      country: { value: "USA" },
    },
  },
  {
    cipherType: CipherType.Card,
    url: `${testSiteHost}/forms/payment/card-payment`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      cardholderName: { value: "John Smith" },
      brand: { value: "Visa" },
      number: { value: "4111111111111111" },
      expMonth: { value: "12" },
      expYear: { value: "2025" },
      code: { value: "123" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/search/simple-search`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeSimpleSearchPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/search/inline-search`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeInlineSearchPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/search/typeless-search`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeTypelessSearchPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/update/update-email`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testEmail,
      },
      password: {
        value: "fakeUpdateEmailPagePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/update/update-password`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testEmail,
      },
      password: {
        value: "fakeUpdatePasswordPagePassword",
      },
    },
  },
];
