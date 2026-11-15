import { describe, expect, it } from "vitest";
import { VoiceBaseline } from "../../src/present/voiceBaseline.js";

describe("VoiceBaseline", () => {
  it("stays in calibration, with a neutral score, until calibrationMs elapses", () => {
    const b = new VoiceBaseline({ calibrationMs: 1000 });
    b.record(0, 0.1, 150);
    expect(b.calibrating).toBe(true);
    expect(b.score).toBe(0.5);
    b.record(900, 0.1, 150);
    expect(b.calibrating).toBe(true);
    b.record(1000, 0.1, 150);
    expect(b.calibrating).toBe(false);
  });

  it("scores a reading at exactly the calibrated average as neutral (0.5)", () => {
    const b = new VoiceBaseline({ calibrationMs: 100 });
    for (let t = 0; t <= 100; t += 10) b.record(t, 0.2, 150);
    expect(b.calibrating).toBe(false);
    b.record(110, 0.2, 150);
    expect(b.score).toBeCloseTo(0.5, 1);
  });

  it("scores a louder-than-baseline reading above neutral", () => {
    const b = new VoiceBaseline({ calibrationMs: 100 });
    // Calibrate on a mix of loudness levels so there's real spread (stdDev > 0).
    for (let t = 0; t <= 100; t += 10) b.record(t, t % 20 === 0 ? 0.1 : 0.3, 150);
    expect(b.calibrating).toBe(false);
    b.record(110, 0.6, 150); // much louder than anything seen during calibration
    expect(b.score).toBeGreaterThan(0.6);
  });

  it("scores a quieter-than-baseline reading below neutral", () => {
    const b = new VoiceBaseline({ calibrationMs: 100 });
    for (let t = 0; t <= 100; t += 10) b.record(t, t % 20 === 0 ? 0.1 : 0.3, 150);
    expect(b.calibrating).toBe(false);
    b.record(110, 0.0, 150);
    expect(b.score).toBeLessThan(0.4);
  });

  it("never throws and stays neutral-ish when every reading has the same loudness (zero variance)", () => {
    const b = new VoiceBaseline({ calibrationMs: 50 });
    for (let t = 0; t <= 50; t += 10) b.record(t, 0.25, null);
    b.record(60, 0.25, null);
    expect(b.score).toBe(0.5);
    expect(Number.isFinite(b.score)).toBe(true);
  });

  it("falls back to loudness alone when pitch is unvoiced (null)", () => {
    const b = new VoiceBaseline({ calibrationMs: 100 });
    for (let t = 0; t <= 100; t += 10) b.record(t, t % 20 === 0 ? 0.1 : 0.3, null);
    b.record(110, 0.6, null);
    expect(b.score).toBeGreaterThan(0.5);
  });

  it("clamps extreme deviations to the 0..1 range", () => {
    const b = new VoiceBaseline({ calibrationMs: 100 });
    for (let t = 0; t <= 100; t += 10) b.record(t, t % 20 === 0 ? 0.1 : 0.3, 150);
    b.record(110, 100, 150); // absurdly loud outlier
    expect(b.score).toBeLessThanOrEqual(1);
    expect(b.score).toBeGreaterThanOrEqual(0);
  });
});
