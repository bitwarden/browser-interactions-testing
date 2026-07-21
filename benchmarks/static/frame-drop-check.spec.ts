import { Page } from "@playwright/test";
import { createBenchmarkTest } from "../fixtures.benchmark";
import { StressCategory, CUSTOM, stressTag } from "../../abstractions/stress";
import {
  defaultGotoOptions,
  defaultWaitForOptions,
  testSiteHost,
} from "../../constants";

// Stresses the frame-drop-check page, which mutates nested shadow roots while an
// animation runs, so the dropped-frame signal is real. Each stress level is its
// own test, giving a per-level distribution across repeatEach runs.
//
// The autofill collector stops traversing shadow DOM at
// MAX_DEEP_QUERY_RECURSION_DEPTH = 4, so taxing-depth sits at that limit and
// grueling puts the mutating leaf beyond it.
//
// Levels map to stress commands by tag: `benchmark:baseline` runs baseline,
// `benchmark:taxing` runs both taxing batches (breadth and depth), and
// `benchmark:grueling` runs grueling.
//
// Two environment variables override the parameters without editing this table:
//
// - FRAME_DROP_OVERRIDE="breadth,depth,interval" replaces the level table with
//   one custom point, tagged `@custom`, for probing the exhausting boundary past
//   the collector's depth limit. The `benchmark` wrapper selects it when the
//   variable is set.
// - FRAME_DROP_WINDOW_MS sets the measured window in milliseconds (default
//   6000). It holds across levels so dropped frames and GC pauses stay
//   comparable.

const { test, expect } = createBenchmarkTest();

const URL_UNDER_TEST = `${testSiteHost}/scenarios/stability/frame-drop-check/`;

interface StressLevel {
  name: string;
  // The stress category this level belongs to. Absent for a custom override.
  category?: StressCategory;
  breadth: number;
  depth: number;
  interval: number;
}

const LEVELS: StressLevel[] = [
  {
    name: "baseline",
    category: StressCategory.Baseline,
    breadth: 1,
    depth: 1,
    interval: 50,
  },
  {
    name: "taxing-breadth",
    category: StressCategory.Taxing,
    breadth: 18,
    depth: 2,
    interval: 50,
  },
  {
    name: "taxing-depth",
    category: StressCategory.Taxing,
    breadth: 10,
    depth: 4,
    interval: 50,
  },
  {
    name: "grueling",
    category: StressCategory.Grueling,
    breadth: 20,
    depth: 10,
    interval: 50,
  },
];

const MEASURE_WINDOW_MS = Number.parseInt(
  process.env.FRAME_DROP_WINDOW_MS ?? "6000",
  10,
);

const SETUP_TIMEOUT_MS = 30_000;

const levels = parseOverride(process.env.FRAME_DROP_OVERRIDE) ?? LEVELS;

for (const level of levels) {
  const title = `frame-drop-check ${level.name} (b${level.breadth} d${level.depth} i${level.interval}ms)`;
  const tag = stressTag(level.category ?? CUSTOM);

  test(title, { tag }, async ({ extensionSetup, impact }) => {
    const page = extensionSetup;

    await page.goto(URL_UNDER_TEST, defaultGotoOptions);

    // Set the knobs before starting mutations. Changing them rebuilds the
    // shadow tree.
    await setNumber(page, "shadowRootBreadth", level.breadth);
    await setNumber(page, "shadowRootDepth", level.depth);
    await setNumber(page, "mutationInterval", level.interval);

    const startButton = page.getByRole("button", { name: /Start mutations/ });
    const stopButton = page.getByRole("button", { name: /Stop mutations/ });
    await startButton.waitFor({
      ...defaultWaitForOptions,
      timeout: SETUP_TIMEOUT_MS,
    });

    await impact.measure(page, URL_UNDER_TEST, async () => {
      await startButton.click();
      await page.waitForTimeout(MEASURE_WINDOW_MS);
      await stopButton.click();
      // Stop becomes disabled on the render after `mutating` flips to false.
      // Awaiting that transition bounds the window so a mutation tick can't fire
      // after stop.
      await expect(stopButton).toBeDisabled();
    });
  });
}

async function setNumber(
  page: Page,
  name: string,
  value: number,
): Promise<void> {
  const input = page.locator(`input[name="${name}"]`);
  await input.waitFor({ ...defaultWaitForOptions, timeout: SETUP_TIMEOUT_MS });
  await input.fill(String(value));
}

function parseOverride(raw?: string): StressLevel[] | null {
  if (!raw) {
    return null;
  }
  const parts = raw.split(",").map((p) => Number.parseInt(p.trim(), 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [breadth, depth, interval] = parts;
  return [
    {
      name: `custom-${breadth}-${depth}-${interval}`,
      breadth,
      depth,
      interval,
    },
  ];
}
