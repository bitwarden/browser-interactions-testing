import fs from "fs";
import path from "path";
import { BrowserContext, CDPSession, Page } from "@playwright/test";
import {
  CaptureMode,
  CdpAttributionBucket,
  CdpCpuResult,
  CdpDefaultResult,
  CdpImpactResult,
} from "../abstractions";
import { IMPACT_OUTPUT_DIR } from "./impact-results";

// Attributes cost to the extension using a debugging session. Sees the
// ground-truth signals the in-page channel cannot: true dropped frames, GC
// pauses, and per-url allocation.
//
// Three modes. Default keeps observer effect low. Cpu adds a V8 CPU profile
// that perturbs the timing it measures. Snapshot adds a full heap snapshot that
// walks the whole object graph. Cpu and snapshot are independent.
//
// The enabled categories are narrow on purpose. The broad timeline and bare
// `v8` categories emit orders of magnitude more events than the frame and gc
// subcategories. GC events come from `disabled-by-default-v8.gc` alone. If the
// top-level Minor/Major events go missing, add bare `v8`.

const FRAME_CATEGORY = "disabled-by-default-devtools.timeline.frame";
const GC_CATEGORY = "disabled-by-default-v8.gc";
const CPU_PROFILER_CATEGORY = "disabled-by-default-v8.cpu_profiler";

const HEAP_SAMPLING_INTERVAL = 4096;

// Engine counters read before and after the window.
const TRACKED_METRICS = [
  "JSHeapUsedSize",
  "JSHeapTotalSize",
  "Nodes",
  "JSEventListeners",
  "LayoutCount",
  "RecalcStyleCount",
];

export interface CdpCaptureHandle {
  /** Enable domains, snapshot baseline counters, and begin tracing. */
  start(): Promise<void>;
  /** End tracing, read back all signals, and return the processed result. */
  stop(): Promise<CdpImpactResult>;
}

type TraceEvent = {
  name?: string;
  cat?: string;
  ph?: string;
  ts?: number;
  dur?: number;
  args?: Record<string, unknown>;
};

/**
 * Create a start/stop capture bound to one page. The caller brackets the measured
 * workload so the trace covers only that window.
 */
export function createCdpCapture(
  context: BrowserContext,
  page: Page,
  opts: { extensionId: string; mode: CaptureMode; snapshotLabel?: string },
): CdpCaptureHandle {
  const { mode } = opts;
  const isExtensionUrl = (url: string | undefined): boolean =>
    !!url &&
    url.includes(`chrome-extension://${opts.extensionId}/`) &&
    url.includes("/content/");

  let session: CDPSession;
  const traceEvents: TraceEvent[] = [];
  let metricsBefore: Record<string, number> = {};
  const poisonReasons: string[] = [];

  const categories = [FRAME_CATEGORY, GC_CATEGORY];
  if (mode === "cpu") {
    categories.push(CPU_PROFILER_CATEGORY);
  }

  return {
    async start() {
      session = await context.newCDPSession(page);
      try {
        await session.send("Performance.enable");
        metricsBefore = await readMetrics(session);

        await session.send("HeapProfiler.enable");
        await session.send("HeapProfiler.startSampling", {
          samplingInterval: HEAP_SAMPLING_INTERVAL,
        });

        session.on(
          "Tracing.dataCollected",
          (params: { value: TraceEvent[] }) => {
            if (params?.value) {
              traceEvents.push(...params.value);
            }
          },
        );

        await session.send("Tracing.start", {
          traceConfig: { includedCategories: categories },
          transferMode: "ReportEvents",
        });
      } catch (e) {
        // Detach so a partial start doesn't leak the session.
        await safeDetach(session);
        throw e;
      }
    },

    async stop(): Promise<CdpImpactResult> {
      const base: Omit<CdpDefaultResult, "tier"> = {};
      let cpuProfile: CdpCpuResult["cpuProfile"];
      let heapSnapshotPath: string | undefined;

      // Stop the sampler and attribute allocation before ending the trace so a
      // long trace flush doesn't stretch the allocation window.
      try {
        const sampling = (await session.send("HeapProfiler.stopSampling")) as {
          profile?: { head?: SamplingNode };
        };
        base.allocation = attributeAllocation(
          sampling?.profile?.head,
          isExtensionUrl,
        );
      } catch (e) {
        poisonReasons.push(`stopSampling failed: ${errText(e)}`);
      }

      try {
        const metricsAfter = await readMetrics(session);
        base.metrics = deltaMetrics(metricsBefore, metricsAfter);
      } catch (e) {
        poisonReasons.push(`getMetrics failed: ${errText(e)}`);
      }

      // End tracing and wait for the terminal event, which also reports whether
      // the browser dropped events. Dropped events poison the capture.
      try {
        const complete = waitForTracingComplete(session);
        await session.send("Tracing.end");
        const { dataLossOccurred, timedOut } = await complete;
        if (timedOut) {
          poisonReasons.push("Tracing.tracingComplete did not fire in time");
        }
        if (dataLossOccurred) {
          poisonReasons.push("trace reported dataLossOccurred");
        }
        base.frames = summarizeFrames(traceEvents);
        base.gc = summarizeGc(traceEvents);
        if (mode === "cpu") {
          cpuProfile = summarizeCpuProfile(traceEvents, isExtensionUrl);
        }
      } catch (e) {
        poisonReasons.push(`tracing failed: ${errText(e)}`);
      }

      if (mode === "snapshot") {
        try {
          heapSnapshotPath = await takeHeapSnapshot(
            session,
            page.url(),
            opts.snapshotLabel,
          );
        } catch (e) {
          poisonReasons.push(`heap snapshot failed: ${errText(e)}`);
        }
      }

      await safeDetach(session);

      if (poisonReasons.length > 0) {
        base.poisoned = true;
        base.poisonReasons = poisonReasons;
      }

      if (mode === "cpu") {
        return { tier: "cpu", ...base, cpuProfile };
      }
      if (mode === "snapshot") {
        return { tier: "snapshot", ...base, heapSnapshotPath };
      }
      return { tier: "default", ...base };
    },
  };
}

async function readMetrics(
  session: CDPSession,
): Promise<Record<string, number>> {
  const { metrics } = (await session.send("Performance.getMetrics")) as {
    metrics: { name: string; value: number }[];
  };
  const map: Record<string, number> = {};
  for (const { name, value } of metrics) {
    map[name] = value;
  }
  return map;
}

function deltaMetrics(
  before: Record<string, number>,
  after: Record<string, number>,
): Record<string, { before: number; after: number; delta: number }> {
  const out: Record<string, { before: number; after: number; delta: number }> =
    {};
  for (const name of TRACKED_METRICS) {
    if (name in before || name in after) {
      const b = before[name] ?? 0;
      const a = after[name] ?? 0;
      out[name] = { before: b, after: a, delta: a - b };
    }
  }
  return out;
}

// --- Frame timeline ---------------------------------------------------------

function summarizeFrames(events: TraceEvent[]): CdpImpactResult["frames"] {
  let requested = 0;
  let presented = 0;
  let dropped = 0;
  let droppedSmoothness = 0;
  let partial = 0;

  for (const e of events) {
    if (e.name === "BeginFrame") {
      requested++;
      continue;
    }
    // The outcome is on the PipelineReporter begin event, under
    // args.frame_reporter.
    if (e.name !== "PipelineReporter" || e.ph !== "b") {
      continue;
    }
    const reporter = e.args?.frame_reporter as
      | { state?: string; affects_smoothness?: boolean }
      | undefined;
    if (!reporter) {
      continue;
    }
    switch (reporter.state) {
      case "STATE_PRESENTED_ALL":
        presented++;
        break;
      case "STATE_PRESENTED_PARTIAL":
        partial++;
        break;
      case "STATE_DROPPED":
        dropped++;
        if (reporter.affects_smoothness) {
          droppedSmoothness++;
        }
        break;
      default:
        break; // Nothing to present.
    }
  }

  return { requested, presented, dropped, droppedSmoothness, partial };
}

// --- GC ---------------------------------------------------------------------

function summarizeGc(events: TraceEvent[]): CdpImpactResult["gc"] {
  let minorCount = 0;
  let majorCount = 0;
  let minorPauseUs = 0;
  let majorPauseUs = 0;

  for (const e of events) {
    if (!e.name || e.dur == null) {
      continue;
    }
    // Count only the top-level events. The sub-phase events double-count.
    if (e.name === "MinorGC" || e.name === "V8.GCScavenger") {
      minorCount++;
      minorPauseUs += e.dur;
    } else if (e.name === "MajorGC" || e.name === "V8.GCCompactor") {
      majorCount++;
      majorPauseUs += e.dur;
    }
  }

  return {
    minorCount,
    majorCount,
    minorPauseMs: minorPauseUs / 1000,
    majorPauseMs: majorPauseUs / 1000,
    totalPauseMs: (minorPauseUs + majorPauseUs) / 1000,
  };
}

// --- Allocation sampling ----------------------------------------------------

type SamplingNode = {
  callFrame?: { functionName?: string; url?: string };
  selfSize?: number;
  children?: SamplingNode[];
};

function attributeAllocation(
  head: SamplingNode | undefined,
  isExtensionUrl: (url: string | undefined) => boolean,
): CdpImpactResult["allocation"] {
  const byUrl = new Map<string, number>();
  let total = 0;
  let extension = 0;

  const walk = (node?: SamplingNode) => {
    if (!node) {
      return;
    }
    const size = node.selfSize ?? 0;
    if (size > 0) {
      const url = node.callFrame?.url || "(unknown)";
      byUrl.set(url, (byUrl.get(url) ?? 0) + size);
      total += size;
      if (isExtensionUrl(node.callFrame?.url)) {
        extension += size;
      }
    }
    node.children?.forEach(walk);
  };
  walk(head);

  return {
    totalSampledBytes: total,
    extensionSampledBytes: extension,
    byUrl: topBuckets(byUrl),
  };
}

// --- CPU profile (cpu mode) -------------------------------------------------

function summarizeCpuProfile(
  events: TraceEvent[],
  isExtensionUrl: (url: string | undefined) => boolean,
): CdpCpuResult["cpuProfile"] {
  // The profiler streams Profile then ProfileChunk events. Nodes accrete across
  // chunks and samples reference node ids. Count samples per url.
  const nodeUrl = new Map<number, string>();
  const sampleCounts = new Map<number, number>();

  for (const e of events) {
    if (e.name !== "ProfileChunk" && e.name !== "Profile") {
      continue;
    }
    const data = (e.args?.data as { cpuProfile?: CpuProfileChunk } | undefined)
      ?.cpuProfile;
    if (!data) {
      continue;
    }
    for (const node of data.nodes ?? []) {
      nodeUrl.set(node.id, node.callFrame?.url || "(unknown)");
    }
    for (const id of data.samples ?? []) {
      sampleCounts.set(id, (sampleCounts.get(id) ?? 0) + 1);
    }
  }

  const byUrl = new Map<string, number>();
  let total = 0;
  let extension = 0;
  for (const [id, count] of sampleCounts) {
    const url = nodeUrl.get(id) || "(unknown)";
    byUrl.set(url, (byUrl.get(url) ?? 0) + count);
    total += count;
    if (isExtensionUrl(nodeUrl.get(id))) {
      extension += count;
    }
  }

  return {
    totalSamples: total,
    extensionSamples: extension,
    byUrl: topBuckets(byUrl),
  };
}

type CpuProfileChunk = {
  nodes?: {
    id: number;
    callFrame?: { functionName?: string; url?: string };
  }[];
  samples?: number[];
};

// --- Heap snapshot (snapshot mode) ------------------------------------------

// Monotonic within the process so snapshots never collide across `repeatEach`
// runs of the same URL (unlike the URL-only name, which would overwrite).
let snapshotSeq = 0;

async function takeHeapSnapshot(
  session: CDPSession,
  pageUrl: string,
  label?: string,
): Promise<string> {
  const dir = path.join(IMPACT_OUTPUT_DIR, "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const base = (label || pageUrl).replace(/[^a-zA-Z0-9_-]/g, "_").slice(-80);
  const file = path.join(dir, `${base}__${snapshotSeq++}.heapsnapshot`);

  const chunks: string[] = [];
  const onChunk = (params: { chunk: string }) => chunks.push(params.chunk);
  session.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
  try {
    await session.send("HeapProfiler.takeHeapSnapshot", {
      reportProgress: false,
    });
  } finally {
    session.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  }
  fs.writeFileSync(file, chunks.join(""));
  return file;
}

// --- shared helpers ---------------------------------------------------------

// Bound the wait so a missing terminal event can't hang the capture.
const TRACING_COMPLETE_TIMEOUT_MS = 30_000;

function waitForTracingComplete(
  session: CDPSession,
): Promise<{ dataLossOccurred: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ dataLossOccurred: false, timedOut: true });
    }, TRACING_COMPLETE_TIMEOUT_MS);
    session.once(
      "Tracing.tracingComplete",
      (params: { dataLossOccurred?: boolean }) => {
        clearTimeout(timer);
        resolve({
          dataLossOccurred: !!params?.dataLossOccurred,
          timedOut: false,
        });
      },
    );
  });
}

function topBuckets(
  byUrl: Map<string, number>,
  n = 15,
): CdpAttributionBucket[] {
  return [...byUrl.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([url, value]) => ({ url, value }));
}

async function safeDetach(session: CDPSession): Promise<void> {
  try {
    await session.detach();
  } catch {
    // The session may already be gone.
  }
}

function errText(e: unknown): string {
  return (e as Error)?.message ?? String(e);
}
