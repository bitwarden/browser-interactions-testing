// The cost signals — stalls, dropped frames, GC pauses, heap growth — an
// impact capture records. A capture has an always-on in-page channel and a
// benchmark-only CDP channel.

/** In-page impact signals from the browser agent. */
export type InPageImpactResult = {
  /** Observation window in ms, since install or last reset. */
  windowMs: number;
  longTasks: {
    count: number;
    totalMs: number;
    /** Blocking time above the 50ms threshold, summed. */
    totalBlockingMs: number;
    maxMs: number;
  };
  loaf: {
    count: number;
    totalMs: number;
    totalBlockingMs: number;
    maxMs: number;
  };
  raf: {
    frames: number;
    /** Frames in the sub-threshold jank band. */
    jankFrames: number;
    /** Frames whose delta exceeded the long-task threshold. */
    dropped: number;
    worstFrameMs: number;
    meanFrameMs: number;
  };
  /** Whether each observer type exists in this browser. */
  supported: {
    longTasks: boolean;
    loaf: boolean;
  };
};

/** One attribution bucket, keyed by source url. */
export type CdpAttributionBucket = {
  url: string;
  value: number;
};

/** Which CDP capture mode produced a result. */
export type CaptureMode = "default" | "cpu" | "snapshot";

/** CDP impact signals shared by every mode. */
type CdpImpactBase = {
  /** Ground-truth compositor frames from the `.frame` trace category. */
  frames?: {
    requested: number;
    presented: number;
    dropped: number;
    droppedSmoothness: number;
    partial: number;
  };
  /** GC pause time from the `disabled-by-default-v8.gc` category. */
  gc?: {
    minorCount: number;
    majorCount: number;
    minorPauseMs: number;
    majorPauseMs: number;
    totalPauseMs: number;
  };
  /** Engine-counter deltas across the window. */
  metrics?: Record<string, { before: number; after: number; delta: number }>;
  /** Allocation sampling, with the extension subset called out. */
  allocation?: {
    totalSampledBytes: number;
    extensionSampledBytes: number;
    byUrl: CdpAttributionBucket[];
  };
  /** Set when the capture is untrustworthy and should be flagged, not reported. */
  poisoned?: boolean;
  poisonReasons?: string[];
};

/** The default mode: cheap signals with low observer effect. */
export type CdpDefaultResult = CdpImpactBase & { tier: "default" };

/** The cpu mode: default signals plus a V8 CPU profile that perturbs timing. */
export type CdpCpuResult = CdpImpactBase & {
  tier: "cpu";
  /** CPU sample counts, with the extension subset called out. */
  cpuProfile?: {
    totalSamples: number;
    extensionSamples: number;
    byUrl: CdpAttributionBucket[];
  };
};

/** The snapshot mode: default signals plus a full heap snapshot on disk. */
export type CdpSnapshotResult = CdpImpactBase & {
  tier: "snapshot";
  heapSnapshotPath?: string;
};

export type CdpImpactResult =
  | CdpDefaultResult
  | CdpCpuResult
  | CdpSnapshotResult;

export type ImpactCapture = {
  url: string;
  timestamp: string;
  inPage?: InPageImpactResult;
  cdp?: CdpImpactResult;
};

export type ImpactPayload = {
  test: string;
  titlePath: string[];
  captures: ImpactCapture[];
};
