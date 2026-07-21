# Performance Instrumentation in BIT

This document is a practical guide for running the BIT performance harness.

- To add a new benchmark, see [Benchmarking](../benchmarking.md)

## Measuring a benchmark

Each command runs one stress category:

```
npm run benchmark:baseline
npm run benchmark:taxing
npm run benchmark:grueling
```

Add a modifier to change the CDP capture mode (see [Experience Impact
metrics](#experience-impact-metrics)) or the run count:

```
npm run benchmark:grueling --cpu         # add a V8 CPU profile
npm run benchmark:grueling --snapshot    # take a heap snapshot (single run)
npm run benchmark:grueling --runs=20     # override the run count
```

Each command runs the benchmark 10 times by default, or once with
`--snapshot`; `--runs=<n>` overrides both. Use the `=` form for `--runs` — npm
drops the value from a bare `--runs 20`. To run a different set of measures, see
"Adding a new measure" below.

Benchmarks are isolated from the regular test suite (`tests/`); they live
in `benchmarks/`, are compiled separately, and run only via these commands.

### Benchmark-specific parameters

Individual benchmarks may expose their own knobs, usually as environment
variables that override a level table for probing a boundary. These belong to
the benchmark, not the harness, so their names and effects live in the spec's
own documentation. Read the header of the spec under `benchmarks/` before
running it.

### Use an instrumented build

Benchmarks should be run using instrumented extension builds. When they are not,
benchmarks that require instrumentation will fail. Use
`npm run build:extension:bench` to create an instrumented build.

### Seed the vault

The benchmark fixture depends on the same setup pipeline as the rest of BIT
(`flightcheck`, `setup:crypto`, `setup:vault`, `seed:vault:ciphers`). Whatever
cipher(s) your benchmark needs must already be seeded.

## Experience Impact metrics

Alongside the User-Timing measures, the harness records the cost the extension
imposes while it runs: main-thread stalls, dropped frames, GC pauses, and heap
growth. These come from two channels.

### In-page channel

An agent records long tasks, Long Animation Frames, and requestAnimationFrame
jank. It needs no debugging session. Benchmarks run it only when they use the
`impact` fixture, so a User-Timing benchmark carries none of its overhead.

### CDP channel (benchmarks only)

Benchmarks that use the `impact` fixture also attach a Chrome DevTools Protocol
session for the measured window. It has three modes, selected by modifier on any
stress command.

- **default** — the frame timeline, GC events, `Performance.getMetrics` deltas,
  and allocation sampling. These signals stand in for what a real page sees. This
  mode answers "how much does the extension cost?" It can be used to compare
  performance before and after a change.
- **cpu** (`--cpu`) — Collects a V8 CPU profile, bucketed by source url.
  This mode answers "where do we spend time processing?" The profiler interrupts
  the main thread frequently, which makes it unsuitable for comparisons. Use it
  to surface processing bottlenecks.
- **snapshot** (`--snapshot`) — Collects a full heap snapshot written to
  `test-summary/impact/snapshots/`. This mode answers "what data do we retain?".
  This mode captures the whole graph and is large, so this mode runs once by
  default. Use it to surface memory leaks.

`cpu` and `snapshot` are independent; pick one per run. Both still collect the
default signals.

## Before/after comparison workflow

A typical use is to measure the same scenario on `main` and on a feature
branch, then compare. The suggested flow:

1. Check out the baseline branch; `npm run build:extension:bench`; run the
   stress command you're comparing (e.g. `npm run benchmark:taxing`); copy
   `test-summary/perf-summary.csv` aside as `baseline.csv`.
2. Check out the candidate branch; rebuild; run the same command; copy
   `perf-summary.csv` as `candidate.csv`.
3. Diff the two CSVs on the natural key `(test_name, url, measure_name)`
   and inspect `count_mean`, `avg_ms_mean`, and `avg_ms_stddev` deltas.
   Treat any `avg_ms_mean` delta smaller than the larger of the two
   sides' `avg_ms_stddev` as noise.

## Output

Every benchmark writes two kinds of file per channel: a per-run file with the
raw capture and an aggregate CSV across repeats. All of them land under
`test-summary/` and are cleared at the start of each benchmark run.

| Channel                       | Per-run detail                                       | Aggregate                         |
| ----------------------------- | ---------------------------------------------------- | --------------------------------- |
| User-Timing measures          | `test-summary/perf/<safe-title-path>__run<n>.json`   | `test-summary/perf-summary.csv`   |
| Experience Impact             | `test-summary/impact/<safe-title-path>__run<n>.json` | `test-summary/impact-summary.csv` |
| Heap snapshots (`--snapshot`) | `test-summary/impact/snapshots/`                     | —                                 |

Both per-run filenames share one convention: the test's title path with any
non-`[a-zA-Z0-9_-]` character replaced by `_`, suffixed `__run<n>` with the
zero-indexed repeat counter. The perf directory is defined in
`benchmarks/utils.ts` and as the default `inputFolder` of
`perf-summary-reporter.ts`; the impact paths in
`instrumentation/impact-results.ts` and `impact-summary-reporter.ts`.

> [!TIP]
> The per-run detail files support finer-grained analyses than the CSV!
>
> - User timing measures are suitable for histogram construction.
> - Experience impact includes long frame analysis.

For what each field and column in these files means, see
[`performance-output.md`](performance-output.md).
