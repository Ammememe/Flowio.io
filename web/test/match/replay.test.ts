// End-to-end: replay the sample talk through the matcher and check the result stays sane.
// Ported from the Phase 0 spike (P4-2) and adapted to schema v1's sampleDeck. These
// thresholds are loose regression guards, not the Phase 0 exit test itself.
import { describe, expect, it } from "vitest";
import { sampleDeck } from "../../src/deck/sampleDeck.js";
import { DEFAULT_CONFIG, Matcher } from "../../src/match/matcher.js";
import { computeMetrics } from "../../src/measure/metrics.js";
import { DEFAULT_SIM, simulateTalk } from "../../src/measure/simulate.js";
import { FakeEmbedder } from "./fakeEmbedder.js";
import { scriptEn } from "./scriptEn.js";

describe("sample talk replay (en)", () => {
  it("keyword-only matching follows every bullet", async () => {
    const matcher = new Matcher(sampleDeck, null, { ...DEFAULT_CONFIG });
    await matcher.prepare();
    const m = computeMetrics(await simulateTalk(matcher, scriptEn, { ...DEFAULT_SIM }));
    expect(m.bullets).toBe(12);
    expect(m.missed).toBe(0);
    expect(m.fromCue!.within1500).toBeGreaterThanOrEqual(0.75);
    expect(m.wrongPer10).toBeLessThanOrEqual(4);
  });

  it("the embedding path runs end to end with a stand-in embedder", async () => {
    const embedder = new FakeEmbedder();
    const matcher = new Matcher(sampleDeck, embedder, { ...DEFAULT_CONFIG });
    await matcher.prepare();
    expect(embedder.calls).toBe(1); // every title/bullet and cue embedded once, up front
    const m = computeMetrics(await simulateTalk(matcher, scriptEn, { ...DEFAULT_SIM }));
    expect(embedder.calls).toBeGreaterThan(50);
    expect(m.hits).toBeGreaterThanOrEqual(10);
  });

  it("is deterministic", async () => {
    const run = async () => {
      const matcher = new Matcher(sampleDeck, null, { ...DEFAULT_CONFIG });
      await matcher.prepare();
      return simulateTalk(matcher, scriptEn, { ...DEFAULT_SIM });
    };
    expect(await run()).toEqual(await run());
  });
});
