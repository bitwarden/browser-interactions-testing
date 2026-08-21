// @ts-nocheck
// This code runs in the page, where DOM globals exist but the harness's Node
// types do not. @ts-nocheck keeps browser-only code here. Typed harness helpers
// live in in-page.ts.

/**
 * The in-page agent as a self-invoking source string for addInitScript.
 * Accumulates long tasks, Long Animation Frames, and requestAnimationFrame
 * jank on window.__bwImpact.
 */
export function inPageAgentSource(): string {
  function agent() {
    if (window.__bwImpact) {
      return;
    }

    // Deltas above the frame budget but below the long-task threshold are jank
    // the long-task signal cannot see.
    const FRAME_BUDGET_MS = 1000 / 60;
    const LONG_TASK_MS = 50;

    function freshCounters() {
      return {
        longTasks: { count: 0, totalMs: 0, totalBlockingMs: 0, maxMs: 0 },
        loaf: { count: 0, totalMs: 0, totalBlockingMs: 0, maxMs: 0 },
        raf: { frames: 0, jankFrames: 0, dropped: 0, worstMs: 0, sumMs: 0 },
      };
    }

    const state = freshCounters();
    // Records which observers this browser provides, so an absent signal is
    // distinguishable from a supported signal that saw nothing. Persists across
    // reset, unlike the counters.
    const supported = { longTasks: false, loaf: false };
    let startedAt = performance.now();
    let lastFrame = performance.now();

    const supportedEntryTypes = PerformanceObserver.supportedEntryTypes ?? [];

    // buffered replays entries from before the observer attached.
    if (supportedEntryTypes.includes("longtask")) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.longTasks.count++;
            state.longTasks.totalMs += entry.duration;
            state.longTasks.totalBlockingMs += Math.max(
              0,
              entry.duration - LONG_TASK_MS,
            );
            if (entry.duration > state.longTasks.maxMs) {
              state.longTasks.maxMs = entry.duration;
            }
          }
        });
        longTaskObserver.observe({ type: "longtask", buffered: true });
        supported.longTasks = true;
      } catch {
        supported.longTasks = false;
      }
    }

    if (supportedEntryTypes.includes("long-animation-frame")) {
      try {
        const loafObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.loaf.count++;
            state.loaf.totalMs += entry.duration;
            state.loaf.totalBlockingMs += entry.blockingDuration || 0;
            if (entry.duration > state.loaf.maxMs) {
              state.loaf.maxMs = entry.duration;
            }
          }
        });
        loafObserver.observe({ type: "long-animation-frame", buffered: true });
        supported.loaf = true;
      } catch {
        supported.loaf = false;
      }
    }

    // A dropped-frame proxy that needs no debugging session. Undercounts real
    // drops.
    function frame(now: number) {
      const delta = now - lastFrame;
      lastFrame = now;
      state.raf.frames++;
      state.raf.sumMs += delta;
      if (delta > state.raf.worstMs) {
        state.raf.worstMs = delta;
      }
      if (delta > LONG_TASK_MS) {
        state.raf.dropped++;
      } else if (delta > FRAME_BUDGET_MS) {
        state.raf.jankFrames++;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    window.__bwImpact = {
      reset() {
        const zeroed = freshCounters();
        state.longTasks = zeroed.longTasks;
        state.loaf = zeroed.loaf;
        state.raf = zeroed.raf;
        startedAt = performance.now();
        lastFrame = performance.now();
      },
      snapshot() {
        const raf = state.raf;
        return {
          windowMs: performance.now() - startedAt,
          longTasks: { ...state.longTasks },
          loaf: { ...state.loaf },
          raf: {
            frames: raf.frames,
            jankFrames: raf.jankFrames,
            dropped: raf.dropped,
            worstFrameMs: raf.worstMs,
            meanFrameMs: raf.frames ? raf.sumMs / raf.frames : 0,
          },
          supported: { ...supported },
        };
      },
    };
  }

  return `(${agent.toString()})();`;
}
