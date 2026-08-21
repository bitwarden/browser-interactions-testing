/** The stress categories every scenario is benchmarked at. */
export const StressCategory = Object.freeze({
  /**
   * A light workload that characterizes the test environment: the noise floor
   * and the environment's own overhead, to subtract from the other levels.
   */
  Baseline: "baseline",
  /**
   * A workload representative of a poorly-performing page seen in the wild. The
   * regression-detection level — the numbers tracked over time and gated on.
   */
  Taxing: "taxing",
  /**
   * A worst-case autofill workload, everything that can go wrong at once, that
   * pushes the autofill architecture to its breaking point.
   */
  Grueling: "grueling",
} as const);

export type StressCategory =
  (typeof StressCategory)[keyof typeof StressCategory];

/**
 * An explicit set of parameters supplied at run time, outside the standing
 * categories. It replaces the level table with one point and carries its own
 * tag.
 */
export const CUSTOM = "custom";

export type StressTagName = StressCategory | typeof CUSTOM;

/** Whether a string is one of the standing stress categories. */
export function isStressCategory(value: string): value is StressCategory {
  return (Object.values(StressCategory) as string[]).includes(value);
}

/** The Playwright tag used to select a category (or a custom point) with `--grep`. */
export function stressTag(name: StressTagName): string {
  return `@${name}`;
}
