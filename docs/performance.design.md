# Performance Instrumentation in BIT — Design Notes

This document complements [`performance.md`](performance.md). Where that
doc is the operator's guide (how to run, how to register a new measure,
how to read the output), this one describes the systems that collect the
data and the decisions that shape how they fit together. Read it when you
need to extend the harness or judge whether a number can be trusted.

## Systems involved

Data collection spans the extension, the browser, and the test runner.

- **The instrumented extension.** The client emits User Timing marks and
  measures from named spans in the autofill code. This instrumentation is
  compiled in behind a build flag, so a stock build carries none of it and a
  measured build carries it wherever the spans are placed.
- **The browser's performance surfaces.** The Performance Timeline holds the
  extension's User Timing entries and the page-observable cost signals — long
  tasks, Long Animation Frames, and requestAnimationFrame timing — that a
  script running in the page can read with no special privilege. The Chrome
  DevTools Protocol (CDP) exposes what the page cannot see for itself: the
  compositor frame timeline, garbage-collection events, engine counters,
  allocation sampling, and heap snapshots.
- **Playwright.** Drives navigation and hosts the fixtures. Its request
  interception is the one hook that can read a document's timeline before
  navigation discards it, and its project and fixture options carry the run's
  configuration.
- **The reporters.** Two aggregators fold the many per-run captures into one
  CSV each — one for User-Timing measures, one for Experience Impact signals —
  for direct before/after comparison.

## Design decisions

### Two channels, split by portability

The Experience Impact signals come from two channels because no single
mechanism is both portable and complete.

The in-page channel uses only standard browser APIs that any script on the page
can reach. It ports to any harness — a Selenium or home-grown framework can
install the same observers — but it sees only what the page sees, and it infers
dropped frames rather than reading them. Because Bitwarden's content scripts run
in isolated worlds, long animation frames caused within them cannot be isolated
using in-page channels.

More precise information on content scripts is, instead, collected using The Crhome
DevTools Protocol (CDP). This requires a debugging session, which ties it to
Chromium and, here, to Playwright. In return, it reads the compositor's own frame,
which allows us to isolate the extension's content scripts from the page's own activity.

The in-page channel travels; the CDP channel goes deep. Keeping them separate lets a
field deployment take the portable signals and a lab run add the rest.

> [!IMPORTANT]
> The [W3C BiDi project](https://w3c.github.io/webdriver-bidi/) is underway to
> introduce CDP-like features beyond the chrome runtime environment. Once these APIs
> are stable, portability across runtimes need no longer constrain the design.

### Capturing before navigation

The Performance Timeline belongs to a document and is discarded when that
document unloads. A measure must therefore be read while its page is still
live, which means the harness has to act in the narrow window between a
navigation being requested and the current document going away.

Playwright's request interception is the only hook that holds that window open:
it pauses a request until the harness releases it, so the timeline can be read
first. Navigation events do not work — they fire after the old document is
gone, or they do not block the navigation and so race the read. If interception
overhead ever matters, an early CDP navigation-lifecycle event is the natural
replacement, at the cost of managing a session for a hook that request
interception already provides for free.

### Keeping the debugging session narrow

A debugging session perturbs what it measures, and a broad trace perturbs it
more. The default mode enables only the trace categories the signals actually
need, so its numbers stay close enough to an unobserved page to stand in for
one — which is what makes the default mode the basis for comparison. The
session brackets each measured window exactly, so the trace covers the workload
and nothing around it.

### Separating the capture modes

Attribution costs something. A CPU profile interrupts the main thread often
enough to distort timing; a heap snapshot walks the whole object graph and is
large. Neither belongs in a run whose purpose is to compare cost. So the
always-collected low-overhead signals form one mode, and each heavier form of
attribution is its own opt-in mode layered on top. A cheap signal is used to
detect a regression; answering "which code" or "what is retained" uses a
fine-grained pass once the cheap signals show there is something to explain.

The modes are mutually exclusive per run, and the result type reflects that:
each mode's extra data lives only on its own variant, so a consumer cannot read
a CPU profile off a run that never took one.

### Reliability: flag, don't report

Measurement can fail quietly — a trace can drop events, a debugging call can
throw, or the extension can mark a measure it knows to be untrustworthy. Rather
than let a misleading number into a comparison, the harness records the failure
and excludes the affected data from the aggregated CSV while keeping it in the
per-run detail for debugging.

This works at two levels. The extension declares a single measure
untrustworthy, which drops that measure from the summary. The harness declares
a whole CDP capture untrustworthy, which drops its debugging-derived columns
but still counts the run. The two axes are independent: within one run a
poisoned measure can sit beside a clean capture, and a clean measure beside a
poisoned capture.

### Isolation from the functional suite

All capture is registered from the benchmark fixture and nowhere else, so the
functional suite is untouched by it. This is deliberate rather than incidental:
the functional suite runs with a slow-motion delay that inflates every timing,
so any measure collected there would be meaningless. Confining instrumentation
to the benchmark path keeps that invalid data from ever being produced.

## Extending the harness

- **Adding a new measure or benchmark**: See the [benchmarking guide](benchmarking.md).

### Widening capture beyond the main frame

The harness reads only the top document of each page (see Limitations).
Extending to iframe-hosted content scripts — the inline menu and notification
bar — is not presently in-scope of benchmarking. Adding this would entail
enumerating all of the frames, filtering to the ones hosting autofill,
keying each capture by frame as well as page, and widening the output schema to carry
the frame identity. The cost is a wider key and more evaluation round-trips per
capture, which is why it is not paid until an iframe entrypoint needs measuring.

> [!WARNING]
> This would let each frame be measured _independently_. Aggregating across
> frames requires the addition of spans and/or correlation ids. These have not
> been anticipated by the design.

## Limitations

### Main-frame only

Capture reads the top document of each page, so content scripts in iframes keep
their own timelines that the harness never collects, and popups or
`window.open`-ed pages are not measured at all. This is fine for autofill
scenarios that stay on a single top-level document, and it is the scope limit
to lift first when iframe entrypoints or multi-page workflows need
instrumentation.

### The capture hook is inside the measured window

Reading the timeline before navigation runs a handler on every request. It is
negligible for BIT's small test pages, but within a benchmark it is part of
what is being measured — a reason to compare harness numbers against other
harness numbers, not against ad-hoc timing taken outside it.

### The measure-name contract is unshared

A measure name links a span in the extension to a column in the output, but the
two repositories hold their own copy of that string with nothing enforcing
agreement. A rename on the extension side does not fail loudly here — it simply
zeroes the measure, which reads the same as a span that never fired. Registering
a new measure (above) means keeping both sides in step by hand until the
contract is shared.
