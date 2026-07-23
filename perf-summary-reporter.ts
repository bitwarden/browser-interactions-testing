import fs from "fs";
import path from "path";
import type { FullResult, Reporter } from "@playwright/test/reporter";

import { PerfPayload } from "./abstractions";

const CSV_HEADER =
  "test_name,url,measure_name,runs,count_mean,count_stddev,avg_ms_mean,avg_ms_stddev,min_ms,max_ms";

interface Bucket {
  testName: string;
  url: string;
  measureName: string;
  counts: number[];
  avgs: number[];
  mins: number[];
  maxes: number[];
}

class PerfSummaryReporter implements Reporter {
  inputFolder: string;
  outputFile: string;

  constructor(options: { inputFolder?: string; outputFile?: string } = {}) {
    this.inputFolder = options.inputFolder || "test-summary/perf";
    this.outputFile = options.outputFile || "test-summary/perf-summary.csv";
  }

  onEnd(_result: FullResult) {
    // Normalizing both branches keeps the per-file containment check below
    // comparing like with like.
    const dir = path.isAbsolute(this.inputFolder)
      ? path.resolve(this.inputFolder)
      : path.join(__dirname, this.inputFolder);
    const outputPath = path.isAbsolute(this.outputFile)
      ? this.outputFile
      : path.join(__dirname, this.outputFile);

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

    // Bucket each `(test, url, measure)` tuple's per-run stats so we can
    // aggregate across iterations. Poisoned runs are excluded from the bucket
    // entirely; if every run for a tuple was poisoned, the tuple gets no row
    // and the operator must inspect the JSON to learn why.
    const buckets = new Map<string, Bucket>();

    for (const file of jsonFiles) {
      const payload = readPerfPayload(dir, file);
      if (!payload) {
        continue;
      }
      const testName = payload.titlePath.join(" > ") || payload.test;
      for (const capture of payload.captures) {
        for (const [measureName, measure] of Object.entries(capture.results)) {
          if (measure.poisoned) {
            continue;
          }
          const key = `${testName}-${capture.url}-${measureName}`;
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = {
              testName,
              url: capture.url,
              measureName,
              counts: [],
              avgs: [],
              mins: [],
              maxes: [],
            };
            buckets.set(key, bucket);
          }
          bucket.counts.push(measure.count);
          bucket.avgs.push(measure.avg);
          bucket.mins.push(measure.min);
          bucket.maxes.push(measure.max);
        }
      }
    }

    const rows: string[] = [CSV_HEADER];
    for (const bucket of buckets.values()) {
      rows.push(
        [
          csvField(bucket.testName),
          csvField(bucket.url),
          csvField(bucket.measureName),
          bucket.counts.length,
          formatMs(mean(bucket.counts)),
          formatMs(stddevPopulation(bucket.counts)),
          formatMs(mean(bucket.avgs)),
          formatMs(stddevPopulation(bucket.avgs)),
          formatMs(Math.min(...bucket.mins)),
          formatMs(Math.max(...bucket.maxes)),
        ].join(","),
      );
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, rows.join("\n") + "\n");
  }
}

function readPerfPayload(dir: string, name: string): PerfPayload | null {
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
    return JSON.parse(fs.readFileSync(fd, "utf8")) as PerfPayload;
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

function formatMs(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Population stddev (divisor N), matching the within-run convention in
// benchmarks/utils.ts. A single-sample input therefore reports 0.
function stddevPopulation(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export default PerfSummaryReporter;
