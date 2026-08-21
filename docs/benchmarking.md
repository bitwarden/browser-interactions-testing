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

Benchmark files live under `benchmarks/static/`. Each constructs its own `test`
object from the fixture factory and tags every test with the stress category
it belongs to — see [`abstractions/stress.ts`](../abstractions/stress.ts). The
`benchmark:<stress>` commands run `playwright test --grep=@<stress>`, so an
untagged test matches no filter and never runs under any `npm run
benchmark:*` command — only via a manual `npx playwright test` invocation.

> [!IMPORTANT]
> A broad set of predictability measures is in development. These are listed in
> `DEFAULT_MEASURES`; pass your own list to `createBenchmarkTest` only when you
> need something other than the default.

There are two measurement patterns. A benchmark can use either, or both in the
same test.

### Measuring User-Timing spans

Call `assertInstrumentationEnabled` right after navigating, so a benchmark run
against a non-instrumented build fails loudly instead of silently reporting
zeroed measures:

```ts
import { createBenchmarkTest } from "../fixtures.benchmark";
import { assertInstrumentationEnabled } from "../../instrumentation";
import { StressCategory, stressTag } from "../../abstractions/stress";
import { defaultGotoOptions, testSiteHost } from "../../constants";

const { test } = createBenchmarkTest();
const URL_UNDER_TEST = `${testSiteHost}/scenarios/.../`;

test(
    "autofill on a basic login form",
    { tag: stressTag(StressCategory.Taxing) },
    async ({ extensionSetup }) => {
        await extensionSetup.goto(URL_UNDER_TEST, defaultGotoOptions);
        await assertInstrumentationEnabled(extensionSetup);
        // your fixed sequence of steps
    },
);
```

The `perfCapture` fixture is auto-attached — it needs no opt-in. It watches
main-frame navigations on `extensionSetup` (the page returned by the fixture,
post-vault-login) and captures performance measures from the page being
navigated _away from_. So benchmark steps should drive `extensionSetup`
directly — `await extensionSetup.goto(testSiteURL, ...)` — rather than opening
a new page via `context.newPage()`. A capture also runs at fixture teardown to
cover the final page in the sequence.

Each repeat writes its own JSON file under `test-summary/perf/` (suffixed with
`__run<n>`), and the `perf-summary-reporter` aggregates everything into
`test-summary/perf-summary.csv` at the end of the run.

### Measuring Experience Impact

Measures the cost the extension imposes just by running — main-thread stalls,
dropped frames, GC, memory growth — via the `impact` fixture, which is set up
only for benchmarks that request it. Wrap the workload in `impact.measure`:

```ts
import { createBenchmarkTest } from "../fixtures.benchmark";
import { StressCategory, stressTag } from "../../abstractions/stress";
import { defaultGotoOptions, testSiteHost } from "../../constants";

const { test } = createBenchmarkTest();
const URL_UNDER_TEST = `${testSiteHost}/scenarios/.../`;

test(
    "frame drops under a taxing workload",
    { tag: stressTag(StressCategory.Taxing) },
    async ({ extensionSetup, impact }) => {
        await extensionSetup.goto(URL_UNDER_TEST, defaultGotoOptions);

        await impact.measure(extensionSetup, URL_UNDER_TEST, async () => {
            // your fixed sequence of steps
        });
    },
);
```

See [`performance.md`](performance.md#experience-impact-metrics) for what each
capture mode records.

### Overhead to plan around

Every benchmark pays the User-Timing route-hook cost, whether or not it
measures a User-Timing span. That's negligible on the static test site, so keep
it that way: pointing a benchmark at a page with many subresources (third-party
scripts, image-heavy forms) puts that cost inside what you're measuring.

Request the `impact` fixture only when you need Experience Impact numbers; a
benchmark that skips it carries none of that channel's overhead. Inside the
`impact` fixture, use the default CDP mode for before/after comparisons, and
reach for `--cpu` only to locate a bottleneck rather than to compare runs —
its profiler perturbs the page too much to trust a delta against it. See
[Experience Impact metrics](performance.md#experience-impact-metrics) for all
three modes.

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
