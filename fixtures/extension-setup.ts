import fs from "fs";
import path from "path";
import { type BrowserContext, type Page, type Worker } from "@playwright/test";

import { defaultGotoOptions, defaultWaitForOptions } from "../constants";

export type FeatureFlags = { [key: string]: boolean };

export async function closeWelcomePage(
  context: BrowserContext,
  // Wait for the extension to open the welcome page before continuing
  // (only relevant when using prod or build artifacts in CI)
  shouldWaitForWelcomePopup: boolean,
): Promise<Page> {
  if (shouldWaitForWelcomePopup) {
    await context.waitForEvent("page");
  }

  const contextPages = await context.pages();

  // close all but the first tab
  await Promise.all(
    contextPages.slice(1).map((contextPage) => contextPage.close()),
  );

  return contextPages[0];
}

export async function prepareEnvironment(
  testPage: Page,
  extensionId: string,
  vaultHostURL: string,
): Promise<void> {
  // Dismiss the welcome carousel
  const introCarouselURL = `chrome-extension://${extensionId}/popup/index.html#/intro-carousel`;
  await testPage.goto(introCarouselURL, defaultGotoOptions);
  const welcomeCarouselDismissButton = await testPage.getByRole("button", {
    name: "Log in",
  });
  await welcomeCarouselDismissButton.click();

  const extensionURL = `chrome-extension://${extensionId}/popup/index.html#/login`;
  await testPage.goto(extensionURL, defaultGotoOptions);

  const environmentSelectorMenuButton = await testPage
    .locator("environment-selector")
    .getByRole("button");

  await environmentSelectorMenuButton.waitFor(defaultWaitForOptions);
  await environmentSelectorMenuButton.click();

  const environmentSelectorMenu = await testPage.getByRole("menuitem", {
    name: "self-hosted",
  });

  await environmentSelectorMenu.waitFor(defaultWaitForOptions);
  await environmentSelectorMenu.click();

  const baseUrlInput = await testPage.locator(
    "input#self_hosted_env_settings_form_input_base_url",
  );
  await baseUrlInput.waitFor(defaultWaitForOptions);

  await baseUrlInput.fill(vaultHostURL);
}

export async function submitEnvironment(testPage: Page): Promise<void> {
  await testPage.click("bit-dialog button[type='submit']");
}

export async function loginToVault(
  testPage: Page,
  extensionId: string,
  vaultEmail: string,
  vaultPassword: string,
): Promise<void> {
  const emailInput = await testPage.getByLabel("Email address");
  await emailInput.waitFor(defaultWaitForOptions);
  await emailInput.fill(vaultEmail);
  const emailSubmitInput = await testPage.getByRole("button", {
    name: "Continue",
  });
  await emailSubmitInput.click();

  const masterPasswordInput = await testPage.getByLabel("Master password");
  await masterPasswordInput.waitFor(defaultWaitForOptions);
  await masterPasswordInput.fill(vaultPassword);

  const loginButton = await testPage.getByRole("button", {
    name: "Log in with master password",
  });
  await loginButton.waitFor(defaultWaitForOptions);
  await loginButton.click();

  const extensionURL = `chrome-extension://${extensionId}/popup/index.html#/tabs/vault`;
  await testPage.waitForURL(extensionURL, defaultGotoOptions);

  // The vault popup is mid-rollout from a legacy list to a refreshed
  // container. This .or() lets us land on either; remove once the legacy
  // selector is no longer reachable in any flag state we test against.
  const vaultFilterBox = await testPage
    .locator("app-vault-filter main .box.list")
    .first();
  const vaultListItems = await testPage
    .locator("app-vault-list-items-container#allItems")
    .first();

  await vaultFilterBox.or(vaultListItems).waitFor(defaultWaitForOptions);
}

export async function getBackgroundPage(
  context: BrowserContext,
  manifestVersion: number,
): Promise<Page | Worker> {
  if (manifestVersion === 3) {
    const existing = context.serviceWorkers()[0];
    return existing ?? (await context.waitForEvent("serviceworker"));
  }

  const existing = context.backgroundPages()[0];
  return existing ?? (await context.waitForEvent("backgroundpage"));
}

export function readManifestVersion(pathToExtension: string): number {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(pathToExtension, "manifest.json"), "utf8"),
  );

  return manifest?.manifest_version;
}

/**
 * We deliberately fetch the configuration from the vault server instead of
 * just pulling in the local `flags.json` because the server may or may not
 * support (and therefore return) the flags in the `flags.json` file.
 */
export async function fetchFeatureFlags(
  vaultHostURL: string,
): Promise<FeatureFlags> {
  try {
    const configUrl = `${vaultHostURL}/api/config`;
    const response = await fetch(configUrl, {
      method: "GET",
      headers: {
        "device-type": "2",
        "bitwarden-client-name": "browser",
      },
    });
    const data = await response.json();
    return data?.featureStates ?? {};
  } catch {
    console.warn(
      "\x1b[1m\x1b[33m%s\x1b[0m",
      "\tCould not fetch feature flags from server config",
    );
    return {};
  }
}
