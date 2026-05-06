import fs from "fs";
import path from "path";
import type { FullResult, Reporter } from "@playwright/test/reporter";

import { PerfPayload } from "./abstractions";

const CSV_HEADER =
  "test_name,url,measure_name,count,total_ms,avg_ms,min_ms,max_ms,stddev_ms";

class PerfSummaryReporter implements Reporter {
  inputFolder: string;
  outputFile: string;

  constructor(options: { inputFolder?: string; outputFile?: string } = {}) {
    this.inputFolder = options.inputFolder || "test-summary/perf";
    this.outputFile = options.outputFile || "test-summary/perf-summary.csv";
  }

  onEnd(_result: FullResult) {
    const dir = path.isAbsolute(this.inputFolder)
      ? this.inputFolder
      : path.join(__dirname, this.inputFolder);
    const outputPath = path.isAbsolute(this.outputFile)
      ? this.outputFile
      : path.join(__dirname, this.outputFile);

    if (!fs.existsSync(dir)) {
      return;
    }

    const jsonFiles = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".json"));

    if (jsonFiles.length === 0) {
      return;
    }

    const rows: string[] = [CSV_HEADER];

    for (const file of jsonFiles) {
      const payload = readPerfPayload(path.join(dir, file));
      if (!payload) {
        continue;
      }
      const testName = payload.titlePath.join(" > ") || payload.test;
      for (const capture of payload.captures) {
        for (const [measureName, measure] of Object.entries(capture.results)) {
          if (measure.poisoned) {
            continue;
          }
          rows.push(
            [
              csvField(testName),
              csvField(capture.url),
              csvField(measureName),
              measure.count,
              formatMs(measure.total),
              formatMs(measure.avg),
              formatMs(measure.min),
              formatMs(measure.max),
              formatMs(measure.stddev),
            ].join(","),
          );
        }
      }
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, rows.join("\n") + "\n");
  }
}

function readPerfPayload(file: string): PerfPayload | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PerfPayload;
  } catch {
    return null;
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

export default PerfSummaryReporter;
