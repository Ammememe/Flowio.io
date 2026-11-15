import { describe, expect, it } from "vitest";
import { detectPitch } from "../../src/present/pitchDetect.js";

const SAMPLE_RATE = 16000;

function sineWave(frequencyHz: number, durationSamples: number, amplitude = 0.5): Float32Array {
  const buffer = new Float32Array(durationSamples);
  for (let i = 0; i < durationSamples; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequencyHz * i) / SAMPLE_RATE);
  }
  return buffer;
}

describe("detectPitch", () => {
  it("recovers the fundamental frequency of a pure tone within 2%", () => {
    for (const freq of [90, 120, 180, 220, 300]) {
      const detected = detectPitch(sineWave(freq, 2048), SAMPLE_RATE);
      expect(detected).not.toBeNull();
      expect(detected!).toBeGreaterThan(freq * 0.98);
      expect(detected!).toBeLessThan(freq * 1.02);
    }
  });

  it("returns null for silence", () => {
    expect(detectPitch(new Float32Array(2048), SAMPLE_RATE)).toBeNull();
  });

  it("returns null for a very quiet signal", () => {
    expect(detectPitch(sineWave(150, 2048, 0.001), SAMPLE_RATE)).toBeNull();
  });

  it("returns null for a frequency outside the human voice range", () => {
    expect(detectPitch(sineWave(1000, 2048), SAMPLE_RATE)).toBeNull();
  });

  it("tolerates white noise without throwing, usually finding no reliable pitch", () => {
    const noise = new Float32Array(2048);
    let seed = 42;
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    expect(() => detectPitch(noise, SAMPLE_RATE)).not.toThrow();
  });
});
