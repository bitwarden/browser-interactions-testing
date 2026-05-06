# Performance Instrumentation in BIT

This document is a practical guide for running the BIT performance harness
and interpreting its output. For the instrumentation API itself, see the
companion doc at `apps/browser/src/autofill/content/performance.md` in the
clients repo. For how the harness is wired internally, extensibility, and
its limitations, see [`performance.design.md`](performance.design.md).

## Running a measured benchmark

Run the benchmark suite:

```
npm run benchmark:static
```

The benchmark fixture enables instrumentation.
By default each benchmark runs 10 times; override with
`BENCHMARK_RUNS=<n>`. To run a different set of measures, see "Adding a
new measure" below.

Benchmarks are isolated from the regular test suite (`tests/`); they live
in `benchmarks/`, are compiled separately, and run only via
`benchmark:static`.

## Adding a new measure

The measure name ties a content-script instrumentation call to the BIT
output. The same string must appear in two places.

### 1. Instrument the code

Add `stopwatch`, `measure`, or `poison` calls in the relevant service in
`clients/apps/browser/src/autofill/`. See
`apps/browser/src/autofill/content/performance.md` in the clients repo for
the full API — it covers the synchronous-only constraint, the `poison`
contract, and the mark/measure naming scheme.

A block example:

```ts
import { measure } from "../content/performance";

const result = measure("criticalCheck", () => {
    return expensiveComputation();
});
```

### 2. Register the measure name in BIT

Either append the name to the default list in
`browser-interactions-testing/benchmarks/utils.ts`:

```ts
export const DEFAULT_MEASURES: readonly string[] = [
    "getShadowRoot",
    "criticalCheck",
];
```

…or pass a custom list to `createBenchmarkTest` in the spec that needs
it:

```ts
const { test } = createBenchmarkTest(["criticalCheck"]);
```

No fixture, reporter, or config changes are needed beyond that — new
measures automatically flow through the existing capture, JSON, and CSV
outputs.

### 3. Rebuild the extension

BIT runs against a real MV3 build of the extension. Benchmarks require the
content-script measurement flag to be set at build time — the standard
`build:extension` script does not enable instrumentation, and benchmarks
against that build will fail clearly at the first navigation. Use the
dedicated bench-build script:

```
npm run build:extension:bench
npm run benchmark:static
```

## Before/after comparison workflow

A typical use is to measure the same scenario on `main` and on a feature
branch, then compare. The suggested flow:

1. Check out the baseline branch; `npm run build:extension:bench`;
   `npm run benchmark:static`; copy `test-summary/perf-summary.csv` aside as
   `baseline.csv`.
2. Check out the candidate branch; rebuild; run again; copy `perf-summary.csv`
   as `candidate.csv`.
3. Diff the two CSVs on the natural key `(test_name, url, measure_name)`
   and inspect `count`, `avg_ms`, and `stddev_ms` deltas.

The raw-entries JSON under `test-summary/perf/<safe-title-path>__run<n>.json`
is available if a finer-grained analysis is wanted (e.g. histograms or
percentiles). One JSON file is written per repeat iteration.

Note that `npm run benchmark:static` wipes `test-summary/perf/` and
`test-summary/perf-summary.csv` at the start of every run, so copy the
CSV (and the per-test JSON if you want it) out before running again.

A measure name registered in `DEFAULT_MEASURES` but never fired during a
test is still written with `count: 0` and zeroed aggregates (and is not
flagged poisoned).

## Output

Both outputs are written to `test-summary/perf/` and are cleared on each
run by the `benchmark:static` script. The directory path itself is
defined in `benchmarks/utils.ts` (for the per-test writer) and as
the default `inputFolder` option of `perf-summary-reporter.ts` (for the
CSV aggregator).

### Per-test JSON

One file per repeat at `test-summary/perf/<safe-title-path>__run<n>.json`,
where `<n>` is the zero-indexed repeat counter. The filename is derived
from the test's title path with any non-`[a-zA-Z0-9_-]` character replaced
by `_`. Schema:

```json
{
    "test": "autofills form on <url>",
    "titlePath": [
        "chromium",
        "autofill-forms.spec.ts",
        "autofills form on <url>"
    ],
    "captures": [
        {
            "url": "https://test-the-web.example/forms/login/shadow-root-inputs",
            "timestamp": "2026-04-24T18:03:11.412Z",
            "results": {
                "<measure>": {
                    "count": 142,
                    "total": 38.12,
                    "avg": 0.268,
                    "min": 0.08,
                    "max": 2.41,
                    "stddev": 0.19,
                    "poisoned": false,
                    "entries": [{ "startTime": 812.4, "duration": 0.12 }]
                }
            }
        }
    ]
}
```

- `captures` is an array per-URL. The current harness collapses re-visits
  to the same URL into the first capture.
- `timestamp` is the wall-clock ISO-8601 time at which the capture ran
  (i.e. the moment `extractMeasures` read the Performance Timeline), not a
  navigation timestamp.
- `entries[].startTime` and `entries[].duration` are both in milliseconds,
  relative to the page's navigation start, as reported by the browser's
  Performance API.
- `count`, `total`, `avg`, `min`, `max`, `stddev` are computed over
  `entries[].duration`; `stddev` is the population standard deviation
  (`N` divisor). A single-entry measure therefore reports `stddev: 0`.
- Poisoned measures are kept in the JSON for debugging and excluded from
  the CSV; see [`performance.design.md`](performance.design.md) for how
  poisoning is detected.

### Aggregated CSV

One file at `test-summary/perf-summary.csv`, emitted by
`perf-summary-reporter.ts` during Playwright's `onEnd` hook. Columns:

```
test_name,url,measure_name,count,total_ms,avg_ms,min_ms,max_ms,stddev_ms
```

One row per `(test, url, measure)` tuple. `test_name` is the test's title
path joined by `>`. Values that contain commas, quotes, or newlines are
RFC-4180-escaped (wrapped in double quotes with internal quotes doubled);
this matters because the title path can legitimately contain commas.

Rows where `poisoned === true` in the source JSON are omitted. If every
row for a run is poisoned, the CSV still contains the header row but no
data rows.
