import path from "path";
import { LocatorWaitForOptions, PageGoToOptions } from "../abstractions";

export const debugIsActive = ["1", "console"].includes(
  process.env.PWDEBUG || "",
);

export const defaultTestTimeout = 480000;
export const defaultNavigationTimeout = 60000;

export const defaultGotoOptions: PageGoToOptions = {
  waitUntil: "domcontentloaded",
  timeout: defaultNavigationTimeout,
};

export const defaultWaitForOptions: LocatorWaitForOptions = {
  state: "visible",
  timeout: 15000,
};

export const screenshotsOutput = path.join(__dirname, "../screenshots");

export const startFromTestUrl = process.env.START_FROM_TEST_URL || null;

export const vaultEmail = process.env.VAULT_EMAIL || "";

export const vaultHostURL = `${process.env.VAULT_HOST_URL}:${process.env.VAULT_HOST_PORT}`;

export const vaultPassword = process.env.VAULT_PASSWORD || "";

export const testUserName = "bwplaywright";
export const testEmail = "bwplaywright@example.com";
export const testTotpSeed = "ABCD EFGH IJKL MNOP";

/*
Some websites "prequalify" an entered email to see if they have an associated account.
If they don't, they may disallow password entry or force account create workflow, so it is
important that `testUserEmail` is a real address with organizational control.
*/
export const testUserEmail = process.env.PUBLIC_TEST_EMAIL || "";
