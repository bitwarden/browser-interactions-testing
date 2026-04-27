export type PerfMeasureResult = {
  count: number;
  total: number;
  avg: number;
  min: number;
  max: number;
  stddev: number;
  poisoned: boolean;
  entries: { startTime: number; duration: number }[];
};

export type PerfCapture = {
  url: string;
  timestamp: string;
  results: Record<string, PerfMeasureResult>;
};

export type PerfPayload = {
  test: string;
  titlePath: string[];
  captures: PerfCapture[];
};
