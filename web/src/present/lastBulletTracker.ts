/**
 * P6-6: pure state machine behind "suggest advancing once the last bullet
 * has been the confident match for a sustained moment" -- pulled out of
 * `liveEngine.ts`'s `tick()` closure so it's testable without the worker
 * embedder, a transcript source, or anything else `createLiveEngine` wires
 * up (see `test/present/lastBulletTracker.test.ts`).
 */
export function createLastBulletTracker() {
  let activeSince: number | null = null;
  let notified = false;

  return {
    /** Call on every slide change -- a new slide gets a fresh judgement. */
    reset(): void {
      activeSince = null;
      notified = false;
    },
    /**
     * `now`: the current clock reading. `isLastTargetActive`: whether the
     * matcher's current pick is this slide's last emphasisable element.
     * Returns true exactly once per `reset()`, the first tick the hold
     * duration is satisfied.
     */
    tick(now: number, isLastTargetActive: boolean, holdMs: number): boolean {
      if (!isLastTargetActive) {
        activeSince = null;
        return false;
      }
      if (activeSince === null) {
        activeSince = now;
        return false;
      }
      if (!notified && now - activeSince >= holdMs) {
        notified = true;
        return true;
      }
      return false;
    },
  };
}
