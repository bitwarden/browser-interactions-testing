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
