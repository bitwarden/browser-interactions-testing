import { LocatorWaitForOptions, PageGoToOptions } from "../../abstractions";

export const debugIsActive = ["1", "console"].includes(
  process.env.PWDEBUG || "",
);

export const defaultGotoOptions: PageGoToOptions = {
  waitUntil: "domcontentloaded",
  timeout: 60000,
};

export const defaultWaitForOptions: LocatorWaitForOptions = {
  state: "visible",
  timeout: 15000,
};

export const startFromTestUrl = process.env.START_FROM_TEST_URL || null;

export const targetTestPages = process.env.TARGET;

export const vaultEmail = process.env.VAULT_EMAIL || "";

export const vaultHostURL = `${process.env.VAULT_HOST_URL}:${process.env.VAULT_HOST_PORT}`;

export const vaultPassword = process.env.VAULT_PASSWORD || "";

export const testUserName = "bwplaywright";
export const testEmail = "bwplaywright@example.com";

/*
Some websites "prequalify" an entered email to see if they have an associated account.
If they don't, they may disallow password entry or force account create workflow, so it is
important that `testUserEmail` is a real address with organizational control.
*/
export const testUserEmail = process.env.PUBLIC_TEST_EMAIL || "";
