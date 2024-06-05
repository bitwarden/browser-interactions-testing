import { Page, Locator } from "@playwright/test";
import { TestNames } from "../constants";

type FillProperties = {
  multiStepNextInputKey?: string;
  preFillActions?: (page: Page) => void;
  selector: string | ((page: Page) => Promise<Locator>);
  shouldNotHaveInlineMenu?: boolean;
  shouldNotFill?: boolean;
  value: string;
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
  skipTests?: TestNameKeys[];
  actions?: {
    submit?: (page: Page) => void;
  };
  // @TODO split this to `shouldNotTriggerNewNotification` and `shouldNotTriggerUpdateNotification`
  shouldNotTriggerNotification?: boolean;
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
