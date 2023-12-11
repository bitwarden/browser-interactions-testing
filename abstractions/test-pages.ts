import { Page, Locator } from "@playwright/test";
import { CipherType, UriMatchType } from "./vault-seeder";

type FillProperties = {
  multiStepNextInputKey?: string;
  preFillActions?: (page: Page) => void;
  selector: string | ((page: Page) => Promise<Locator>);
  shouldNotFill?: boolean;
  value: string;
};

type PageTest = {
  cipherType: CipherType;
  url: string;
  uriMatchType?: UriMatchType;
  onlyTest?: boolean;
  inputs: {
    // Login fields
    username?: FillProperties;
    password?: FillProperties;
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
};

type AutofillPageTest = PageTest & {
  additionalLoginUrls?: string[];
};

type NotificationPageTest = PageTest & {
  actions?: {
    submit?: (page: Page) => void;
  };
  shouldNotTriggerNotification?: boolean;
};

type LocatorWaitForOptions = {
  state?: "visible" | "attached" | "detached" | "hidden";
  timeout?: number;
};

type PageGoToOptions = {
  waitUntil: "domcontentloaded" | "load" | "networkidle" | "commit";
  timeout?: number;
  referer?: string;
};

export {
  FillProperties,
  AutofillPageTest,
  PageTest,
  NotificationPageTest,
  LocatorWaitForOptions,
  PageGoToOptions,
};
