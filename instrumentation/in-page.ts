import { BrowserContext, Page } from "@playwright/test";
import { InPageImpactResult } from "../abstractions";
import { inPageAgentSource } from "./in-page-agent";

/**
 * Install the in-page agent on every page of the context. Call before
 * navigation so the agent's buffered observers replay earlier entries.
 */
export async function installInPageInstrumentation(
  context: BrowserContext,
): Promise<void> {
  await context.addInitScript(inPageAgentSource());
}

/** Read the current in-page accumulators, or null if the agent is absent. */
export async function readInPageImpact(
  page: Page,
): Promise<InPageImpactResult | null> {
  return page.evaluate(() => {
    const api = (globalThis as { __bwImpact?: { snapshot(): unknown } })
      .__bwImpact;
    return (api ? api.snapshot() : null) as InPageImpactResult | null;
  });
}

/** Zero the accumulators and restart the observation window. */
export async function resetInPageImpact(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __bwImpact?: { reset(): void } }).__bwImpact?.reset();
  });
}

/**
 * Mark the page's current document as the one an impact window measures. Call
 * at the start of the window; `impactWindowHeld` gives the verdict at the end.
 */
export async function markImpactWindow(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __bwImpactWindow?: boolean }).__bwImpactWindow = true;
  });
}

/**
 * Report whether the marked document is still the live one. False means a
 * navigation replaced it mid-window, so readings taken afterward describe only
 * the document the workload ended on.
 *
 * A document restored from the back/forward cache keeps its mark, so a
 * workload that navigates away and back reads as held.
 */
export async function impactWindowHeld(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      (globalThis as { __bwImpactWindow?: boolean }).__bwImpactWindow === true,
  );
}
