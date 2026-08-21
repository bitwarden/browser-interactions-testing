import path from "path";
import fs from "fs";
import { TestInfo } from "@playwright/test";
import { ImpactCapture } from "../abstractions";

// Writes one JSON file per run for the impact-summary-reporter to aggregate.
//
// FIXME: the write body duplicates writePerfResults. A shared
// writeRunResults(dir, testInfo, captures) would unify them.
export const IMPACT_OUTPUT_DIR = path.resolve("test-summary/impact");

export async function writeImpactResults(
  testInfo: TestInfo,
  captures: ImpactCapture[],
): Promise<void> {
  if (captures.length === 0) {
    return;
  }
  fs.mkdirSync(IMPACT_OUTPUT_DIR, { recursive: true });
  const safeName =
    `${testInfo.titlePath.join("__")}__run${testInfo.repeatEachIndex}`.replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );
  const payload = {
    test: testInfo.title,
    titlePath: testInfo.titlePath,
    captures,
  };
  fs.writeFileSync(
    path.join(IMPACT_OUTPUT_DIR, `${safeName}.json`),
    JSON.stringify(payload, null, 2),
  );
}
