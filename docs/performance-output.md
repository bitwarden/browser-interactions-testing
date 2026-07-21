# Performance Output Files

This document explains how to read each file the BIT performance harness
writes. For running benchmarks and the filesystem layout, see
[`performance.md`](performance.md).

The harness writes two artifacts per channel — a per-run file holding the raw
capture, and a CSV aggregating across repeats for direct before/after
comparison. Read a per-run file when a CSV number needs explaining or a finer
cut (histogram, percentile) is wanted. The files group under two metric
categories:

- [**Experience Impact**](#experience-impact) — the overhead the extension
  imposes just by running: [summary CSV](#experience-impact-summary-csv),
  [per-run JSON](#experience-impact-per-run-json).
- [**Predictability**](#predictability) — whether that cost is legible and how
  much it varies, read through the User-Timing measures:
  [summary CSV](#user-timing-summary-csv),
  [per-test JSON](#user-timing-per-test-json).

## Experience Impact

This category measures the overhead the extension imposes simply by running —
main-thread stalls, dropped frames, GC pressure, memory growth — regardless of
whether autofill fills correctly. It reads two channels: an in-page channel that
runs anywhere, and a CDP channel that a debugging session adds during
benchmarks.

A few terms recur across both files:

- **Long task** — a stretch of main-thread work lasting 50ms or more, long
  enough to keep the page from responding to input. The browser's Long Tasks
  API reports them.
- **Long Animation Frame (LoAF)** — a frame the browser took too long to
  render, reported together with the script work that delayed it. It ties a
  delay to a rendered frame where a long task only reports the work.
- **requestAnimationFrame (rAF)** — the callback the browser runs once per
  frame. The in-page agent times the gap between consecutive callbacks to infer
  frame health without a debugging session.
- **Jank** — visible stutter: a frame slower than the display's refresh interval
  (~16.7ms at 60Hz) but short of the dropped-frame threshold.
- **Dropped frame** — a frame that missed its presentation deadline. The rAF
  agent counts one when the callback gap falls between 50ms and the ~1s cutoff
  it treats as a backgrounded tab; the CDP channel reads the compositor's own
  dropped count.
- **GC** — garbage collection, the pauses the JavaScript engine takes to reclaim
  memory. Long or frequent pauses surface as stalls.

### Experience Impact summary CSV

One row per `(test, url)` bucket, aggregated across runs. Each row carries these
columns:

- `test_name` — the test's title path joined by `>`, with commas, quotes, or
  newlines RFC-4180-escaped.
- `url` — the page the capture was taken on.
- `runs` — captures that contributed. The in-page columns draw on every one.
- `window_ms_mean` — mean observation window across runs.
- `raf_frames_mean` — mean rendered-frame count.
- `raf_jank_mean` — mean count of frames in the sub-threshold jank band.
- `raf_dropped_mean` — mean count of frames whose delta crossed the long-task
  threshold.
- `raf_worst_ms_max` — the single worst frame duration across all runs (a max,
  not a mean).
- `longtask_runs` — runs where the long-task observer was available. A zero
  marks an observer the browser does not support, so its zeroed means read as
  "unsupported" rather than "idle."
- `longtask_count_mean` — mean long-task count over the available runs.
- `longtask_blocking_ms_mean` — mean long-task blocking time (above the 50ms
  threshold) over the available runs.
- `loaf_runs` — runs where the Long Animation Frame observer was available,
  read like `longtask_runs`.
- `loaf_count_mean` — mean LoAF count over the available runs.
- `loaf_blocking_ms_mean` — mean LoAF blocking time over the available runs.
- `cdp_runs` — trustworthy CDP captures that carried a frame summary, the
  denominator for `cdp_frames_dropped_mean`. Each other CDP mean covers the
  captures that carried its own sub-object, so a trustworthy capture missing one
  signal is left out of that column alone.
- `cdp_frames_dropped_mean` — mean count of compositor frames that missed
  presentation.
- `cdp_gc_pause_ms_mean` — mean total GC pause time per run.
- `cdp_js_heap_delta_mean` — mean of the per-run `JSHeapUsedSize.delta`.
- `cdp_ext_alloc_bytes_mean` — mean sampled allocation attributed to the
  extension's content scripts.
- `cdp_poisoned_runs` — CDP captures excluded as unreliable.

Read the per-run JSON under `test-summary/impact/` for the full per-capture
detail these columns summarize — the CPU profile and snapshot path never reach
the CSV.

### Experience Impact per-run JSON

One file per run, following the `ImpactPayload` shape in
`abstractions/impact-types.ts`. Each capture carries an in-page channel and,
for benchmark runs, a CDP channel:

```json
{
    "test": "frame-drop-check grueling (b20 d10 i50ms)",
    "titlePath": [
        "default",
        "frame-drop-check.spec.ts",
        "frame-drop-check grueling (b20 d10 i50ms)"
    ],
    "captures": [
        {
            "url": "https://test-the-web.example/scenarios/stability/frame-drop-check/",
            "timestamp": "2026-04-24T18:03:11.412Z",
            "inPage": {
                "windowMs": 6000,
                "longTasks": {
                    "count": 12,
                    "totalMs": 940,
                    "totalBlockingMs": 340,
                    "maxMs": 180
                },
                "loaf": {
                    "count": 9,
                    "totalMs": 720,
                    "totalBlockingMs": 260,
                    "maxMs": 150
                },
                "raf": {
                    "frames": 312,
                    "jankFrames": 40,
                    "dropped": 22,
                    "worstFrameMs": 96,
                    "meanFrameMs": 19
                },
                "supported": { "longTasks": true, "loaf": true }
            },
            "cdp": {
                "tier": "default",
                "frames": {
                    "requested": 360,
                    "presented": 338,
                    "dropped": 22,
                    "droppedSmoothness": 14,
                    "partial": 3
                },
                "gc": {
                    "minorCount": 8,
                    "majorCount": 1,
                    "minorPauseMs": 24,
                    "majorPauseMs": 12,
                    "totalPauseMs": 36
                },
                "metrics": {
                    "JSHeapUsedSize": {
                        "before": 18200000,
                        "after": 22600000,
                        "delta": 4400000
                    }
                },
                "allocation": {
                    "totalSampledBytes": 5100000,
                    "extensionSampledBytes": 3800000,
                    "byUrl": []
                },
                "poisoned": false
            }
        }
    ]
}
```

- `inPage` (`InPageImpactResult`) is present for every capture.
    - `windowMs` is the observation window since install or the last reset.
    - `longTasks` and `loaf` count tasks and Long Animation Frames;
      `totalBlockingMs` sums the time above the 50ms blocking threshold.
    - `raf.jankFrames` are frames in the sub-threshold jank band; `raf.dropped`
      are frames whose delta crossed the long-task threshold.
    - `supported` records whether the browser provides each observer. A `false`
      here means the paired counts are absent, not idle — the aggregate treats
      them as unsupported rather than zero.
- `cdp` (`CdpImpactResult`) is present only when the CDP channel ran. It is a
  discriminated union on `tier` (`default`, `cpu`, or `snapshot`); the mode's
  extra field appears only on its own member.
    - `frames` are ground-truth compositor frames; `dropped` is the count that
      missed presentation.
    - `gc` sums pause time from top-level GC events.
    - `metrics` holds `Performance.getMetrics` counters as `before`/`after`/`delta`
      triples; `JSHeapUsedSize.delta` is heap growth over the window.
    - `allocation` buckets sampled bytes by source url, with the extension's
      content-script subset called out in `extensionSampledBytes`.
    - `cpu` tier adds `cpuProfile` (sample counts, extension subset called out);
      `snapshot` tier adds `heapSnapshotPath` pointing into
      `test-summary/impact/snapshots/`.
    - `poisoned: true` marks a capture that cannot be trusted (dropped trace
      events, a missing terminal event, or a thrown protocol call);
      `poisonReasons` lists why. A poisoned capture is counted but excluded from
      the CDP columns of the CSV.

## Predictability

This category asks whether the extension's cost is legible — whether we can say
ahead of time what a code path costs and how much that cost varies. User-Timing
measures are its readout. Each names a span inside the extension (a `measure` or
`stopwatch` call in the autofill code) and times every time it runs, and the
files report how much each span's duration and firing count move across runs. A
steady measure is predictable; a wide spread marks a path whose cost is hard to
anticipate, whatever its source.

### User-Timing summary CSV

One row per `(test, url, measure)` tuple, aggregated across all repeats of that
tuple. Each row carries these columns:

- `test_name` — the test's title path joined by `>`. Values containing
  commas, quotes, or newlines are RFC-4180-escaped (wrapped in double quotes
  with internal quotes doubled); the title path can legitimately contain commas.
- `url` — the page the measures were captured on.
- `measure_name` — the User-Timing measure this row aggregates.
- `runs` — non-poisoned per-test JSON files that contributed. Equal to
  `BENCHMARK_RUNS` for healthy runs; smaller if iterations were poisoned.
- `count_mean` — mean measurement count per run.
- `count_stddev` — population stddev of the count per run. A non-zero value
  means the measure fired a different number of times across repeats, which
  usually indicates a flaky scenario.
- `avg_ms_mean` — the headline number: mean of per-run averages. Most
  before/after comparisons read this first.
- `avg_ms_stddev` — population stddev of per-run averages: how much the
  measurement varies across iterations. The most useful column when judging
  whether a candidate-vs-baseline delta is real. If
  `|candidate.avg_ms_mean − baseline.avg_ms_mean|` is smaller than the larger
  `avg_ms_stddev`, the difference is in the noise.
- `min_ms` — the smallest entry duration across all contributing runs.
- `max_ms` — the largest entry duration across all contributing runs.

Within-run stats (`total_ms`, and the per-run `stddev_ms` of individual entry
durations) do not appear in the CSV; the per-test JSON keeps them. Rows where
every contributing run was poisoned are omitted. A run in which every row is
poisoned still produces the header row and no data rows.

### User-Timing per-test JSON

One file per repeat, following the `PerfPayload` shape in
`abstractions/perf-types.ts`:

```json
{
    "test": "getShadowRoot during runaway grid rerenders",
    "titlePath": [
        "default",
        "rerendering-input-grid.spec.ts",
        "getShadowRoot during runaway grid rerenders"
    ],
    "captures": [
        {
            "url": "https://test-the-web.example/scenarios/stability/rerendering-input-grid/",
            "timestamp": "2026-04-24T18:03:11.412Z",
            "results": {
                "getShadowRoot": {
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

- `captures` is an array per-URL. The harness collapses re-visits to the same
  URL into the first capture.
- `timestamp` is the wall-clock ISO-8601 time at which the capture ran (the
  moment `extractMeasures` read the Performance Timeline).
- `entries[].startTime` and `entries[].duration` are both in milliseconds,
  relative to the page's navigation start, as reported by the browser's
  Performance API.
- `count`, `total`, `avg`, `min`, `max`, `stddev` are computed over
  `entries[].duration`; `stddev` is the population standard deviation (`N`
  divisor). A single-entry measure reports `stddev: 0`.
- Poisoned measures stay in the JSON for debugging and drop from the CSV; see
  [`performance.design.md`](performance.design.md) for how poisoning is
  detected.
- A measure registered in `DEFAULT_MEASURES` but never fired is written with
  `count: 0` and zeroed aggregates, and is not flagged poisoned.
