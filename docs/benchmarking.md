# Benchmarking

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

## Writing a benchmark

Each benchmark file constructs its own `test` object from the fixture factory. If your benchmark measures specific predictability figures, pass them into `createBenchmarkTest`.

> [!IMPORTANT]
> A broad set of predictability measures is in development. These are listed in `DEFAULT_MEASURES`.

```ts
import { createBenchmarkTest } from "./fixtures.benchmark";

const { test } = createBenchmarkTest(["getShadowRoot"]);

test("autofill on a basic login form", async ({ extensionSetup }) => {
    // your fixed sequence of steps, navigating extensionSetup to the URL under test
});
```

The `perfCapture` fixture is auto-attached. It watches main-frame navigations on `extensionSetup` (the page returned by the fixture, post-vault-login) and captures performance measures from the page being navigated _away from_. So benchmark steps should drive `extensionSetup` directly — `await extensionSetup.goto(testSiteURL, ...)` — rather than opening a new page via `context.newPage()`. A capture also runs at fixture teardown to cover the final page in the sequence.

Each repeat writes its own JSON file under `test-summary/perf/` (suffixed with `__run<n>`), and the `perf-summary-reporter` aggregates everything into `test-summary/perf-summary.csv` at the end of the run.

A note on overhead: the capture mechanism uses `context.route("**/*")`, which routes every request through a JavaScript handler in the test process. The handler short-circuits non-navigation requests, but the user-space round-trip still happens for each one. For static test-site pages this is negligible; if you point a benchmark at a page with many subresources (third-party scripts, image-heavy forms), expect the route hook to show up as part of what you're measuring.

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
`instrumentation/user-timing.ts`:

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

BIT runs against a real MV3 build of the extension. The User-Timing measures
require the content-script measurement flag to be set at build time — the
standard `build:extension` script does not enable it. Use the dedicated
bench-build script instead:

```
npm run build:extension:bench
npm run benchmark:taxing
```
