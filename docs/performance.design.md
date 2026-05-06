# Performance Instrumentation in BIT — Design Notes

This document complements [`performance.md`](performance.md). Where that
doc is the operator's guide (how to run, how to register a new measure,
how to read the output), this one covers the internals: how the harness
is plumbed end-to-end, how poisoning is detected, and what the harness
cannot do. Read this when you need to extend the framework itself.

## How it works

### Suite isolation

The harness lives entirely under `benchmarks/`, separate from `tests/`.
The benchmark fixture (`benchmarks/fixtures.benchmark.ts`) is the only
place that injects the instrumentation init script and registers the
capture hook. Regular tests never load it, so adding, disabling, or
extending the harness has no effect on the rest of the suite.

### Content-script enablement

Instrumentation is gated by the client build using the
`BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS` environment variable. The
`npm run build:extension:bench` script in this repo rebuilds the
client using this variable.

To detect a misconfigured run early, each spec should call
`assertInstrumentationEnabled(page)` (in `benchmarks/utils.ts`)
immediately after the first `goto`. This method throws an error
if run on an incorrect build.

### Capture timing

Measures are captured **before** each main-frame navigation so the
`performance` timeline is not lost on reload. The `perfCapture` fixture
registers a `context.route("**/*")` handler that, on main-frame navigation
requests, calls `extractMeasures` via `page.evaluate` to read the current
page's entries, then calls `route.continue()` to let the navigation
proceed. A second capture runs at fixture teardown to cover the common
case where a test only loads one page.

Captures are keyed by URL and deduplicated per test. URLs served from
`chrome-extension://` and `about:blank` are excluded — the harness only
records real test-site pages.

### How poisoning is detected

The clients-side library's `poison("foo")` call emits a
`foo:poison:autofill:bw` mark onto the Performance Timeline. During
extraction, the harness runs `page.evaluate` to call
`performance.getEntriesByName(…, "mark")` for the poison name of each
measure and sets `poisoned: true` on the result when any such mark
exists. The `count`, `total`, `avg`, etc. fields remain populated even
when poisoned, so the JSON preserves the raw data for debugging. The CSV
reporter excludes poisoned rows entirely — the CSV is intended for direct
before/after comparison where untrustworthy numbers must not be included.

### Output pipeline

`benchmarks/utils.ts` owns the per-test writer (`writePerfResults`),
which writes one JSON document per repeat into `test-summary/perf/`. The
filename suffix `__run<n>` separates the iterations of a repeated
benchmark. The per-test payload uses the `PerfPayload` shape in
`abstractions/perf-types.ts`, which is shared by both the fixture-side
writer and the reporter-side reader.

`perf-summary-reporter.ts` at the repo root is a custom Playwright
reporter implementing `onEnd`. It reads every JSON in the perf output
directory, flattens to one CSV row per `(test, url, measure)` tuple,
drops rows where the source result is poisoned, and writes
`test-summary/perf-summary.csv`. It is registered only in
`playwright.benchmark.config.ts`; the regular test config does not load
it.

## Extending the harness

### Adding a new measure point

Covered in the operator's guide ([`performance.md`](performance.md)) — in
short, add the `stopwatch`/`measure` call clients-side, then either
append the name to `DEFAULT_MEASURES` in `benchmarks/utils.ts` or
pass a custom list to `createBenchmarkTest` in the spec that needs it.

### Iframe-scoped measures

Currently unsupported (see Limitations below). To extend:

1. Enumerate `page.frames()` instead of reading only the main frame.
2. Call `frame.evaluate` against each frame of interest, filtering out
   the ones that don't host autofill content scripts.
3. Key captures by `(page-url, frame-url)` instead of page URL alone, and
   widen the CSV schema with a `frame_url` column.

### Alternative capture mechanisms

The current before-nav capture relies on `context.route`, which awaits
user-space code before allowing a request to proceed. Alternatives that
were considered and rejected:

- `page.on("framenavigated")` — fires _after_ navigation, by which point
  the prior frame's Performance Timeline has been destroyed. The
  extract would read the new frame's empty timeline.
- `page.on("request")` with `isNavigationRequest()` — Playwright event
  listeners do not block the navigation from proceeding, so an
  `await extractMeasures` inside the handler races the navigation.

If route-handler overhead becomes a problem, the most promising replacement
is a `CDPSession` listener on `Page.frameRequestedNavigation`. That event
fires early in the nav lifecycle and, unlike `framenavigated`, gives us
a window in which the previous page is still live. It is not used today
because it adds CDP-session management surface for a small gain.

## Limitations

### Iframe-scoped measures not collected

The harness captures measures only from the main frame of each page.
Content scripts that run inside cross-origin or same-origin iframes
accumulate their own `performance` timelines in those frames;
`extractMeasures` currently calls `page.evaluate`, which targets the main
frame's realm, so iframe-scoped entries are not collected.

This will matter when the `inline-menu` and `notification-bar`
entrypoints are instrumented — both of those scripts run inside iframes.
See [Extending the harness](#iframe-scoped-measures) above for the
remediation sketch.

### Route-handler overhead

Registering the main-frame navigation hook uses `context.route("**/*")`,
which forwards every request through a JavaScript handler. This is
negligible for the small test pages exercised by BIT but is not free;
the handler is only installed by the benchmark fixture, so the regular
test suite is unaffected. Within a benchmark, the route hook is part of
what is being measured — keep this in mind when comparing benchmark
numbers to ad-hoc timing data captured outside the harness.

### Main-frame only

The teardown capture and the route-hook capture both read `page.url()`
and `page.mainFrame()`. Popups and `window.open`-ed pages are not
measured. Fine for autofill scenarios that stay on a single top-level
document; a limitation to revisit if workflows that span multiple
top-level pages need instrumentation.
