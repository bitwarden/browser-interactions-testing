import { Page, Locator } from "@playwright/test";
import { TestNames } from "../constants";

type FillProperties = {
  multiStepNextInputKey?: string;
  preFillActions?: (page: Page) => void;
  selector: string | ((page: Page) => Promise<Locator>);
  /** Represents the expectation that the inline menu should not appear on the input */
  shouldNotHaveInlineMenu?: boolean;
  /** Represents the expectation that the input should not be autofilled */
  shouldNotAutofill?: boolean;
  /** Skip the (Playwright) action of manually filling an input as a simulated user entry  */
  skipSimulatedUserValueEntry?: boolean;
  /** Used by autofill tests to represent expected values, and by other tests as values to be entered ( @TODO separate these concerns ) */
  valueToUse: string;
  expectedValue: string;
};

type PageTest = {
  url: string;
  inputs: {
    // Login fields
    username?: FillProperties;
    password?: FillProperties;
    newPassword?: FillProperties;
    newPasswordRetype?: FillProperties;
    totp?: FillProperties;

    // Card fields
    cardholderName?: FillProperties;
    brand?: FillProperties;
    number?: FillProperties;
    expMonth?: FillProperties;
    expYear?: FillProperties;
    code?: FillProperties;

    // Identity fields
    title?: FillProperties;
    firstName?: FillProperties;
    middleName?: FillProperties;
    lastName?: FillProperties;
    address1?: FillProperties;
    address2?: FillProperties;
    address3?: FillProperties;
    city?: FillProperties;
    state?: FillProperties;
    postalCode?: FillProperties;
    country?: FillProperties;
    company?: FillProperties;
    email?: FillProperties;
    phone?: FillProperties;
    ssn?: FillProperties;
    passportNumber?: FillProperties;
    licenseNumber?: FillProperties;
  };
  onlyTest?: boolean;
  /** Tests that should not be run against the page pattern because they are known failures or are not applicable */
  skipTests?: TestNameKeys[];
  actions?: {
    submit?: (page: Page) => void;
  };
  /** Represents the expectation that the new item notification should not appear upon form submission */
  shouldNotTriggerNewNotification?: boolean;
  /** Represents the expectation that the update item notification should not appear upon form submission */
  shouldNotTriggerUpdateNotification?: boolean;
};

type TestNameKeys = (typeof TestNames)[keyof typeof TestNames];

type LocatorWaitForOptions = {
  state?: "visible" | "attached" | "detached" | "hidden";
  timeout?: number;
};

type PageGoToOptions = {
  waitUntil: "domcontentloaded" | "load" | "networkidle" | "commit";
  timeout?: number;
  referer?: string;
};

export { FillProperties, LocatorWaitForOptions, PageGoToOptions, PageTest };
