import { describe, expect, it } from "vitest";
import { createLastBulletTracker } from "../../src/present/lastBulletTracker.js";

describe("createLastBulletTracker", () => {
  it("fires once the hold duration is satisfied", () => {
    const tracker = createLastBulletTracker();
    expect(tracker.tick(0, true, 3000)).toBe(false); // just became active
    expect(tracker.tick(2000, true, 3000)).toBe(false); // not held long enough yet
    expect(tracker.tick(3000, true, 3000)).toBe(true); // held exactly long enough
  });

  it("never fires twice for the same hold without a reset", () => {
    const tracker = createLastBulletTracker();
    tracker.tick(0, true, 3000);
    expect(tracker.tick(3000, true, 3000)).toBe(true);
    expect(tracker.tick(4000, true, 3000)).toBe(false);
    expect(tracker.tick(10000, true, 3000)).toBe(false);
  });

  it("resets the clock when the active target changes away and back", () => {
    const tracker = createLastBulletTracker();
    tracker.tick(0, true, 3000);
    expect(tracker.tick(2000, false, 3000)).toBe(false); // briefly not the last target
    expect(tracker.tick(2500, true, 3000)).toBe(false); // clock restarted at 2500, not held 3000ms yet
    expect(tracker.tick(5500, true, 3000)).toBe(true); // now held long enough from the restart
  });

  it("fires again after an explicit reset (e.g. the slide changed)", () => {
    const tracker = createLastBulletTracker();
    tracker.tick(0, true, 3000);
    expect(tracker.tick(3000, true, 3000)).toBe(true);
    tracker.reset();
    expect(tracker.tick(3000, true, 3000)).toBe(false); // just became active again after reset
    expect(tracker.tick(6000, true, 3000)).toBe(true);
  });

  it("never fires while the last target isn't active", () => {
    const tracker = createLastBulletTracker();
    expect(tracker.tick(0, false, 3000)).toBe(false);
    expect(tracker.tick(10000, false, 3000)).toBe(false);
  });
});
