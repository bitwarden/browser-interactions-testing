import fs from "fs";
import path from "path";
import type { FullResult, Reporter } from "@playwright/test/reporter";

import { ImpactCapture, ImpactPayload } from "../abstractions";

// Aggregates the per-run impact JSON into one CSV, bucketed by (test, url). A
// poisoned CDP capture is left out of the CDP columns but still counts toward
// `runs`, so an unreliable level reads as present with empty CDP data.
//
// A capture the benchmark invalidated contributes nothing but the
// `invalid_runs` count.
//
// FIXME: shares its onEnd/bucket/csv shape with perf-summary-reporter. A shared
// base would unify them.
const CSV_HEADER = [
  "test_name",
  "url",
  "runs",
  "window_ms_mean",
  "raf_frames_mean",
  "raf_jank_mean",
  "raf_dropped_mean",
  "raf_worst_ms_max",
  "longtask_runs",
  "longtask_count_mean",
  "longtask_blocking_ms_mean",
  "loaf_runs",
  "loaf_count_mean",
  "loaf_blocking_ms_mean",
  "cdp_runs",
  "cdp_frames_dropped_mean",
  "cdp_gc_pause_ms_mean",
  "cdp_js_heap_delta_mean",
  "cdp_ext_alloc_bytes_mean",
  "cdp_poisoned_runs",
  "invalid_runs",
].join(",");

interface Bucket {
  testName: string;
  url: string;
  runs: number;
  windowMs: number[];
  rafFrames: number[];
  rafJank: number[];
  rafDropped: number[];
  rafWorst: number[];
  longtaskCount: number[];
  longtaskBlocking: number[];
  loafCount: number[];
  loafBlocking: number[];
  cdpFramesDropped: number[];
  cdpGcPause: number[];
  cdpHeapDelta: number[];
  cdpExtAlloc: number[];
  cdpPoisoned: number;
  invalid: number;
}

class ImpactSummaryReporter implements Reporter {
  inputFolder: string;
  outputFile: string;

  constructor(options: { inputFolder?: string; outputFile?: string } = {}) {
    this.inputFolder = options.inputFolder || "test-summary/impact";
    this.outputFile = options.outputFile || "test-summary/impact-summary.csv";
  }

  onEnd(_result: FullResult) {
    // Relative paths resolve against the working directory, matching where
    // writeImpactResults writes. Normalizing unconditionally keeps the
    // per-file containment check below comparing like with like.
    const dir = path.resolve(this.inputFolder);
    const outputPath = path.resolve(this.outputFile);

    if (!fs.existsSync(dir)) {
      return;
    }

    const jsonFiles = fs
      .readdirSync(dir, { withFileTypes: true })
      // Regular files only. Skipping symlinks stops a link planted in the
      // directory from redirecting the read to a file outside it.
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name);
    if (jsonFiles.length === 0) {
      return;
    }

    const buckets = new Map<string, Bucket>();
    for (const file of jsonFiles) {
      const payload = readImpactPayload(dir, file);
      if (!payload) {
        continue;
      }
      const testName = payload.titlePath.join(" > ") || payload.test;
      for (const capture of payload.captures) {
        const bucket = getBucket(buckets, testName, capture.url);
        addCapture(bucket, capture);
      }
    }

    const rows: string[] = [CSV_HEADER];
    for (const bucket of buckets.values()) {
      rows.push(
        [
          csvField(bucket.testName),
          csvField(bucket.url),
          bucket.runs,
          fmt(mean(bucket.windowMs)),
          fmt(mean(bucket.rafFrames)),
          fmt(mean(bucket.rafJank)),
          fmt(mean(bucket.rafDropped)),
          fmt(bucket.rafWorst.length ? Math.max(...bucket.rafWorst) : 0),
          bucket.longtaskCount.length,
          fmt(mean(bucket.longtaskCount)),
          fmt(mean(bucket.longtaskBlocking)),
          bucket.loafCount.length,
          fmt(mean(bucket.loafCount)),
          fmt(mean(bucket.loafBlocking)),
          bucket.cdpFramesDropped.length,
          fmt(mean(bucket.cdpFramesDropped)),
          fmt(mean(bucket.cdpGcPause)),
          fmt(mean(bucket.cdpHeapDelta)),
          fmt(mean(bucket.cdpExtAlloc)),
          bucket.cdpPoisoned,
          bucket.invalid,
        ].join(","),
      );
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, rows.join("\n") + "\n");
  }
}

function getBucket(
  buckets: Map<string, Bucket>,
  testName: string,
  url: string,
): Bucket {
  const key = `${testName}-${url}`;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      testName,
      url,
      runs: 0,
      windowMs: [],
      rafFrames: [],
      rafJank: [],
      rafDropped: [],
      rafWorst: [],
      longtaskCount: [],
      longtaskBlocking: [],
      loafCount: [],
      loafBlocking: [],
      cdpFramesDropped: [],
      cdpGcPause: [],
      cdpHeapDelta: [],
      cdpExtAlloc: [],
      cdpPoisoned: 0,
      invalid: 0,
    };
    buckets.set(key, bucket);
  }
  return bucket;
}

function addCapture(bucket: Bucket, capture: ImpactCapture) {
  // Counted so the exclusion is visible, then dropped: an invalid capture
  // measured something other than what the benchmark asked for.
  if (capture.invalidReasons?.length) {
    bucket.invalid++;
    return;
  }

  bucket.runs++;

  const inPage = capture.inPage;
  if (inPage) {
    bucket.windowMs.push(inPage.windowMs);
    bucket.rafFrames.push(inPage.raf.frames);
    bucket.rafJank.push(inPage.raf.jankFrames);
    bucket.rafDropped.push(inPage.raf.dropped);
    bucket.rafWorst.push(inPage.raf.worstFrameMs);
    // Only count runs where the observer exists. An unsupported observer
    // reports zero, which would otherwise bias the mean toward zero and read
    // the same as an idle one. A zero `*_runs` column marks unsupported.
    if (inPage.supported.longTasks) {
      bucket.longtaskCount.push(inPage.longTasks.count);
      bucket.longtaskBlocking.push(inPage.longTasks.totalBlockingMs);
    }
    if (inPage.supported.loaf) {
      bucket.loafCount.push(inPage.loaf.count);
      bucket.loafBlocking.push(inPage.loaf.totalBlockingMs);
    }
  }

  const cdp = capture.cdp;
  if (cdp) {
    if (cdp.poisoned) {
      bucket.cdpPoisoned++;
      return;
    }
    if (cdp.frames) {
      bucket.cdpFramesDropped.push(cdp.frames.dropped);
    }
    if (cdp.gc) {
      bucket.cdpGcPause.push(cdp.gc.totalPauseMs);
    }
    const heap = cdp.metrics?.JSHeapUsedSize;
    if (heap) {
      bucket.cdpHeapDelta.push(heap.delta);
    }
    if (cdp.allocation) {
      bucket.cdpExtAlloc.push(cdp.allocation.extensionSampledBytes);
    }
  }
}

function readImpactPayload(dir: string, name: string): ImpactPayload | null {
  // `name` is a directory entry, so it is already a basename; resolving it and
  // confirming it still sits directly under `dir` rejects anything that would
  // read outside the directory.
  const resolved = path.resolve(dir, name);
  if (path.dirname(resolved) !== dir) {
    return null;
  }
  let fd: number | undefined;
  try {
    // O_NOFOLLOW refuses a symlink swapped in for the entry after it was
    // listed, so the read cannot be redirected outside the directory.
    fd = fs.openSync(
      resolved,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
    return JSON.parse(fs.readFileSync(fd, "utf8")) as ImpactPayload;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      fs.closeSync(fd);
    }
  }
}

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function fmt(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export default ImpactSummaryReporter;
