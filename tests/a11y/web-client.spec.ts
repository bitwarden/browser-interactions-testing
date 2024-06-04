import {
  authenticatedWebClientViewPaths,
  debugIsActive,
  defaultGotoOptions,
  messageColor,
  unauthenticatedWebClientViewPaths,
  vaultEmail,
  vaultHostURL,
} from "../../constants";
import { test, expect } from "../fixtures.web";
import { a11yTestView } from "../utils";

test.describe("Web client", { tag: ["@web-client", "@a11y"] }, async () => {
  await test(`a11y evaluation should pass`, async ({
    webClientSetup,
  }, testInfo) => {
    const urlSharedPathBase = "/#/";
    const urlBase = `${vaultHostURL}${urlSharedPathBase}`;

    let testPage = await webClientSetup;
    let violationsCount = 0;

    for (const viewPath of authenticatedWebClientViewPaths) {
      await test.step(`for path: \`${urlSharedPathBase + viewPath}\``, async () => {
        const newViolationsCount = await a11yTestView({
          testInfo,
          testPage,
          urlBase,
          urlSharedPathBase,
          viewPath,
        });

        await expect
          .soft(
            newViolationsCount,
            `view for \`${urlSharedPathBase + viewPath}\` should yield 0 violations`,
          )
          .toEqual(0);

        violationsCount += newViolationsCount;
      });
    }

    await test.step(
      "Log out of the web client in order to test the unauthenticated views",
      async () => {
        await testPage.getByRole("button", { name: vaultEmail }).click();
        await testPage.getByRole("menuitem", { name: "Log out" }).click();
        await testPage.waitForURL(`${urlBase}login`, defaultGotoOptions);
      },
      { box: true },
    );

    for (const viewPath of unauthenticatedWebClientViewPaths) {
      await test.step(`for path: \`${urlSharedPathBase + viewPath}\``, async () => {
        const newViolationsCount = await a11yTestView({
          testInfo,
          testPage,
          urlBase,
          urlSharedPathBase,
          viewPath,
        });

        await expect
          .soft(
            newViolationsCount,
            `view for \`${urlSharedPathBase + viewPath}\` should yield 0 violations`,
          )
          .toEqual(0);

        violationsCount += newViolationsCount;
      });
    }

    if (violationsCount) {
      console.warn(
        messageColor.yellowForeground,
        `${violationsCount} a11y issues were discovered. See log output and attached report for details.`,
      );
    }

    expect
      .soft(violationsCount, `Tests should yield 0 total violations`)
      .toEqual(0);

    // Add some buffer at the end of testing so any animations/transitions have a chance to
    // complete before the recording is ended
    await testPage.waitForTimeout(2000);

    // Hold the window open (don't automatically close out) when debugging
    if (debugIsActive) {
      await testPage.pause();
    }

    await testPage.close();
  });
});
