import { spawnSync } from "child_process";
import {
  isStressCategory,
  StressCategory,
  CUSTOM,
  stressTag,
} from "../abstractions/stress";

// Maps `npm run benchmark:<stress>` onto a Playwright project (the CDP capture
// mode) and a `--grep` tag (the stress category). The tags come from the shared
// `stress` module the specs tag themselves from, so the two cannot drift.
//
// Modifiers may be passed as script args (`-- --snapshot`) or as npm flags
// (`--snapshot`, which npm exposes as `npm_config_snapshot`). `--cpu` and
// `--snapshot` are bare booleans. `--runs` takes a value and must use the `=`
// form (`--runs=20`), because npm drops the value from a bare `--runs 20`.

const stress = process.argv[2];
if (!isStressCategory(stress)) {
  console.error(
    `Usage: benchmark <${Object.values(StressCategory).join("|")}> [--cpu | --snapshot] [--runs=<n>]`,
  );
  process.exit(1);
}

const args = process.argv.slice(3);
const wants = (flag: string): boolean =>
  args.includes(`--${flag}`) || !!process.env[`npm_config_${flag}`];

// A valued flag, accepted as `--flag value`, `--flag=value`, or the
// `npm_config_flag` npm exposes. A bare `--flag` reaches npm as the string
// "true", which is not a value.
const flagValue = (flag: string): string | undefined => {
  const eq = args.find((a) => a.startsWith(`--${flag}=`));
  if (eq) {
    return eq.slice(flag.length + 3);
  }
  const idx = args.indexOf(`--${flag}`);
  const next = idx === -1 ? undefined : args[idx + 1];
  if (next && !next.startsWith("--")) {
    return next;
  }
  const fromNpm = process.env[`npm_config_${flag}`];
  return fromNpm && fromNpm !== "true" ? fromNpm : undefined;
};

const cpu = wants("cpu");
const snapshot = wants("snapshot");
if (cpu && snapshot) {
  console.error("Choose one of --cpu or --snapshot, not both.");
  process.exit(1);
}
const project = snapshot ? "snapshot" : cpu ? "cpu" : "default";

// A benchmark runs 10 times by default, or once for a snapshot. --runs=<n>
// overrides both. Reject a malformed or valueless count rather than silently
// defaulting, so a bare `--runs 20` that loses its value through npm fails
// loudly instead of passing unnoticed.
const runsAttempted =
  args.some((a) => a === "--runs" || a.startsWith("--runs=")) ||
  process.env.npm_config_runs !== undefined;
const runsRaw = flagValue("runs");
let runs: number;
if (runsRaw !== undefined) {
  const parsed = Number.parseInt(runsRaw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.error(
      `Invalid --runs value "${runsRaw}". Use --runs=<positive integer>, e.g. --runs=20.`,
    );
    process.exit(1);
  }
  runs = parsed;
} else if (runsAttempted) {
  console.error(
    "--runs needs the = form: --runs=<n>. A bare `--runs <n>` loses its value through npm.",
  );
  process.exit(1);
} else {
  runs = snapshot ? 1 : 10;
}

// A FRAME_DROP_OVERRIDE point carries the custom tag and replaces the level
// table, so target it directly rather than the stress category.
const grepTag = process.env.FRAME_DROP_OVERRIDE
  ? stressTag(CUSTOM)
  : stressTag(stress);

function run(command: string, commandArgs: string[], env?: NodeJS.ProcessEnv) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.signal) {
    console.error(`${command} was terminated by signal ${result.signal}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", [
  "rimraf",
  "benchmarks-out",
  "test-summary/perf",
  "test-summary/perf-summary.csv",
  "test-summary/impact",
  "test-summary/impact-summary.csv",
]);
run("npx", ["tsc", "--incremental", "-p", "benchmarks/tsconfig.json"]);
run(
  "npx",
  [
    "playwright",
    "test",
    "--config=playwright.benchmark.config.ts",
    `--project=${project}`,
    `--grep=${grepTag}`,
  ],
  { NODE_EXTRA_CA_CERTS: "ssl.crt", BENCHMARK_RUNS: String(runs) },
);
