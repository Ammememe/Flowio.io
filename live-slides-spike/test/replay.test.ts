// End-to-end: replay both sample talks through the matcher and check the result stays sane.
// These thresholds are loose regression guards, not the Phase 0 exit test.
import { describe, expect, it } from 'vitest';
import { DECKS } from '../src/deck';
import { DEFAULT_CONFIG, Matcher } from '../src/match/matcher';
import { computeMetrics } from '../src/measure/metrics';
import { DEFAULT_SIM, simulateTalk } from '../src/measure/simulate';
import { FakeEmbedder } from './fakeEmbedder';

describe.each(['en', 'sv'])('sample talk replay (%s)', (lang) => {
  const { deck, script } = DECKS[lang];

  it('keyword-only matching follows every bullet', async () => {
    const matcher = new Matcher(deck, null, { ...DEFAULT_CONFIG });
    await matcher.prepare();
    const m = computeMetrics(await simulateTalk(matcher, script, { ...DEFAULT_SIM }));
    expect(m.bullets).toBe(12);
    expect(m.missed).toBe(0);
    expect(m.fromCue!.within1500).toBeGreaterThanOrEqual(0.75);
    expect(m.wrongPer10).toBeLessThanOrEqual(4);
  });

  it('the embedding path runs end to end with a stand-in embedder', async () => {
    const embedder = new FakeEmbedder();
    const matcher = new Matcher(deck, embedder, { ...DEFAULT_CONFIG });
    await matcher.prepare();
    expect(embedder.calls).toBe(1); // every bullet and cue embedded once, up front
    const m = computeMetrics(await simulateTalk(matcher, script, { ...DEFAULT_SIM }));
    expect(embedder.calls).toBeGreaterThan(50);
    expect(m.hits).toBeGreaterThanOrEqual(10);
  });

  it('is deterministic', async () => {
    const run = async () => {
      const matcher = new Matcher(deck, null, { ...DEFAULT_CONFIG });
      await matcher.prepare();
      return simulateTalk(matcher, script, { ...DEFAULT_SIM });
    };
    expect(await run()).toEqual(await run());
  });
});
