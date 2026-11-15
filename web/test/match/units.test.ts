// Ported from the Phase 0 spike's test/units.test.ts (P4-2), unchanged except the import paths.
import { describe, expect, it } from "vitest";
import { buildKeywordTargets, keywordScore } from "../../src/match/keyword.js";
import { Stabilizer } from "../../src/match/stabilizer.js";
import { contentTokens, sameWord, tokenize } from "../../src/match/text.js";
import { WordBuffer } from "../../src/match/wordBuffer.js";
import { computeMetrics, type LogEvent } from "../../src/measure/metrics.js";

describe("text", () => {
  it("tokenizes with Swedish letters and drops punctuation", () => {
    expect(tokenize("Höjdrodret på stjärten, pekar: nosen!")).toEqual(["höjdrodret", "på", "stjärten", "pekar", "nosen"]);
  });
  it("removes stop words in both languages", () => {
    expect(contentTokens("the wing is on the plane")).toEqual(["wing", "plane"]);
    expect(contentTokens("vingen är på planet och det")).toEqual(["vingen", "planet"]);
  });
  it("matches inflected forms but not unrelated or short words", () => {
    expect(sameWord("engine", "engines")).toBe(true);
    expect(sameWord("lift", "lifting")).toBe(true);
    expect(sameWord("vinge", "vingar")).toBe(true);
    expect(sameWord("tryck", "trycket")).toBe(true);
    expect(sameWord("luft", "lyft")).toBe(false);
    expect(sameWord("air", "airplane")).toBe(false);
    expect(sameWord("lift", "life")).toBe(false);
  });
});

describe("WordBuffer", () => {
  it("keeps the first-seen time of a word while a segment is revised", () => {
    const buf = new WordBuffer();
    buf.update("a", "the wing", 1000);
    buf.update("a", "the wing is curved", 3000);
    expect(buf.window(3000, 1000)).toBe("is curved");
    expect(buf.window(3000, 5000)).toBe("the wing is curved");
  });
  it("orders segments as spoken and prunes old ones", () => {
    const buf = new WordBuffer();
    buf.update("a", "first part", 1000);
    buf.update("b", "second part", 4000);
    expect(buf.window(4000, 10000)).toBe("first part second part");
    buf.prune(9000, 6000);
    expect(buf.window(9000, 10000)).toBe("second part");
  });
});

describe("keywords", () => {
  const targets = buildKeywordTargets([
    { id: "a", texts: ["Fuel burns and hot gas blasts out the back"] },
    { id: "b", texts: ["A jet engine pulls in air and compresses it"] },
    { id: "c", texts: ["Modern engines send most air around the core"] },
  ]);
  it("weights words shared between bullets lower", () => {
    const b = targets.find((t) => t.id === "b")!;
    expect(b.tokens.find((t) => t.tok === "engine")!.weight).toBe(0.5);
    expect(b.tokens.find((t) => t.tok === "jet")!.weight).toBe(1);
  });
  it("scores the bullet whose distinctive words were spoken", () => {
    const spoken = contentTokens("then the fuel is burning");
    const scores = Object.fromEntries(targets.map((t) => [t.id, keywordScore(t, spoken)]));
    expect(scores.a).toBeGreaterThan(0.7);
    expect(scores.b).toBe(0);
  });
});

describe("Stabilizer", () => {
  const cfg = { enter: 0.4, margin: 0.08, exit: 0.15, confirmMs: 300, minHoldMs: 1500, releaseMs: 7000 };
  const rows = (a: number, b: number) => [
    { id: "a", score: a },
    { id: "b", score: b },
  ];

  it("waits for confirmation before highlighting", () => {
    const s = new Stabilizer(cfg);
    expect(s.update(rows(0.6, 0.1), 0)).toBeNull();
    expect(s.update(rows(0.6, 0.1), 200)).toBeNull();
    expect(s.update(rows(0.6, 0.1), 400)).toBe("a");
  });
  it("ignores weak scores and close calls", () => {
    const s = new Stabilizer(cfg);
    for (let t = 0; t <= 2000; t += 200) expect(s.update(rows(0.35, 0.1), t)).toBeNull();
    for (let t = 2200; t <= 4000; t += 200) expect(s.update(rows(0.6, 0.56), t)).toBeNull();
  });
  it("holds a highlight for the minimum time, then lets it move", () => {
    const s = new Stabilizer(cfg);
    s.update(rows(0.6, 0.1), 0);
    s.update(rows(0.6, 0.1), 400);
    expect(s.update(rows(0.1, 0.7), 600)).toBe("a");
    expect(s.update(rows(0.1, 0.7), 1200)).toBe("a");
    expect(s.update(rows(0.1, 0.7), 2000)).toBe("b");
  });
  it("keeps the highlight when unsure and releases it after a long silence", () => {
    const s = new Stabilizer(cfg);
    s.update(rows(0.6, 0.1), 0);
    s.update(rows(0.6, 0.1), 400);
    expect(s.update(rows(0, 0), 3000)).toBe("a");
    expect(s.update(rows(0, 0), 7300)).toBe("a");
    expect(s.update(rows(0, 0), 7500)).toBeNull();
  });
});

describe("metrics", () => {
  it("computes delay, misses and wrong highlights", () => {
    const events: LogEvent[] = [
      { t: 0, type: "marker", slide: "s1", bullet: "a" },
      { t: 1000, type: "highlight", slide: "s1", bullet: "a" },
      { t: 5000, type: "marker", slide: "s1", bullet: "b" },
      { t: 6000, type: "highlight", slide: "s1", bullet: "c" }, // wrong
      { t: 8000, type: "highlight", slide: "s1", bullet: "b" },
      { t: 10000, type: "marker", slide: "s1", bullet: null },
      { t: 15000, type: "marker", slide: "s1", bullet: "d" }, // never highlighted
      { t: 20000, type: "end" },
    ];
    const m = computeMetrics(events);
    expect(m.bullets).toBe(3);
    expect(m.hits).toBe(2);
    expect(m.missed).toBe(1);
    expect(m.fromStart.delaysMs).toEqual([1000, 3000]);
    expect(m.fromCue).toBeNull();
    expect(m.wrong).toBe(1);
    expect(m.wrongPer10).toBeCloseTo(3.33, 1);
    expect(m.passFromStart).toBe(false);
  });
  it("counts a bullet that is already highlighted as an immediate hit", () => {
    const m = computeMetrics([
      { t: 0, type: "highlight", slide: "s1", bullet: "a" },
      { t: 500, type: "marker", slide: "s1", bullet: "a" },
      { t: 3000, type: "end" },
    ]);
    expect(m.fromStart.delaysMs).toEqual([0]);
    expect(m.passFromStart).toBe(true);
  });
  it("reports delay from the cue point separately from delay from the start", () => {
    const m = computeMetrics([
      { t: 0, type: "marker", slide: "s1", bullet: "a", cueT: 2000 },
      { t: 3000, type: "highlight", slide: "s1", bullet: "a" },
      { t: 9000, type: "end" },
    ]);
    expect(m.fromStart.delaysMs).toEqual([3000]);
    expect(m.fromCue?.delaysMs).toEqual([1000]);
    expect(m.passFromStart).toBe(false);
    expect(m.passFromCue).toBe(true);
  });
});
