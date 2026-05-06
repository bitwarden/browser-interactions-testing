# Benchmarks

A benchmark measures one specific extension flow many times so we can talk about its runtime as a distribution, not a single number. The folder is intentionally separate from `tests/` — benchmarks have a different purpose, a different fixture, and a different Playwright config.

## What makes a good benchmark

A benchmark is a small, repeatable measurement of one specific flow.

- **One flow per file.** If you want to measure two flows, write two files.
- **A fixed sequence of steps.** Same actions, in the same order, every run.
- **Captures runtime metrics, doesn't assert expectations.** A benchmark that fails the run instead of recording the metric loses the data point. Wait for the elements you need, then move on; let the perf reporter speak for the result.
- **Not data-driven.** No `for (const page of pages)` loops. Pick one URL, one cipher, one path. Vary something? That's a different benchmark.

## Determinism matters

The whole point is that runs are comparable to each other. A few practical habits:

- Pre-seed the cipher you need; rely on the standard `npm run seed:vault:ciphers` pipeline.
- Wait for specific selectors rather than fixed sleeps — sleeps mask timing variance and add their own.
- Avoid actions whose timing depends on the network if you can.

## How runs are configured

- **Iterations:** `BENCHMARK_RUNS` controls how many times each benchmark runs. Default is 10.
- **Always serial.** `fullyParallel: false` and `workers: 1`. Both because MV3 requires a single extension instance and because parallel runs contaminate timing.
- **Isolated from the test suite.** Benchmarks live in `benchmarks/`, not `tests/`. They are not picked up by `npm run test:static` / `test:public` / `test:a11y`. They run only via `npm run benchmark:static`.

## Writing one

Each benchmark file constructs its own `test` object from the fixture factory. Pass the measure names you care about; default is `DEFAULT_MEASURES`.

```ts
import { createBenchmarkTest } from "./fixtures.benchmark";

const { test } = createBenchmarkTest(["getShadowRoot"]);

test("autofill on a basic login form", async ({ extensionSetup }) => {
  // your fixed sequence of steps, navigating extensionSetup to the URL under test
});
```

The `perfCapture` fixture is auto-attached. It watches main-frame navigations on `extensionSetup` (the page returned by the fixture, post-vault-login) and captures performance measures from the page being navigated *away from*. So benchmark steps should drive `extensionSetup` directly — `await extensionSetup.goto(testSiteURL, ...)` — rather than opening a new page via `context.newPage()`. A capture also runs at fixture teardown to cover the final page in the sequence.

Each repeat writes its own JSON file under `test-summary/perf/` (suffixed with `__run<n>`), and the `perf-summary-reporter` aggregates everything into `test-summary/perf-summary.csv` at the end of the run.

A note on overhead: the capture mechanism uses `context.route("**/*")`, which routes every request through a JavaScript handler in the test process. The handler short-circuits non-navigation requests, but the user-space round-trip still happens for each one. For static test-site pages this is negligible; if you point a benchmark at a page with many subresources (third-party scripts, image-heavy forms), expect the route hook to show up as part of what you're measuring.

## Prerequisites

### Instrumented build required

Benchmarks measure named entries written by the extension's autofill content scripts. Those entries are only produced when the extension is built with content-script measurements enabled — a build-time flag, not a runtime one (see [`docs/performance.md`](../docs/performance.md) and the design rationale at `clients/apps/browser/src/autofill/content/performance.design.md`).

Use the dedicated build script:

```
npm run build:extension:bench
```

> [!WARNING]
> Running benchmarks against a default `build:extension` output will fail at the first `goto` with a specific error pointing at this script — silent zero-count data is not produced.

### Vault seeding

The benchmark fixture logs into the configured vault and depends on the same setup pipeline as the rest of the suite (`flightcheck`, `setup:crypto`, `setup:vault`, `seed:vault:ciphers`). Whatever cipher your benchmark needs must already be seeded.
