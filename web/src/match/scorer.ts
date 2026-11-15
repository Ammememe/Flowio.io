// P0-4/P4-2: per-target scores for the current slide = embedding similarity + keyword overlap.
// Ported from the Phase 0 spike and adapted to the schema v1 Deck (title/bullet elements,
// via `emphasisTargets`) instead of the spike's own throwaway `Bullet[]` shape.

import type { Deck } from "@flowio/shared";
import { buildKeywordTargets, keywordScore, type KeywordTarget } from "./keyword.js";
import { contentTokens, cosine, tokenize } from "./text.js";
import { emphasisTargets } from "./targets.js";

/** Anything that turns texts into vectors. The browser uses a Transformers.js worker; tests use a fake. */
export interface Embedder {
  readonly label: string;
  embed(texts: string[]): Promise<ArrayLike<number>[]>;
}

export interface ScoreRow {
  id: string;
  /** 0..1 embedding similarity above the "unrelated talk" baseline. */
  emb: number;
  /** 0..1 keyword overlap. */
  kw: number;
  /** Combined score the stability rules act on. */
  score: number;
}

export interface ScoreWeights {
  /** Share of the score that comes from embeddings; the rest comes from keywords. */
  embWeight: number;
  /** Share of the score that comes from the short, most recent window. */
  recentWeight: number;
}

// Generic presenter talk in both languages. A target's similarity to these is its "unrelated" baseline,
// which makes scores comparable between embedding models whose raw cosine ranges differ a lot.
const NEUTRAL = [
  "thank you all for coming today",
  "okay so let us move on to the next part",
  "does anyone have any questions so far",
  "I will come back to that in a moment",
  "as I said before this is quite interesting",
  "let me just take a sip of water",
  "tack för att ni kom hit idag",
  "okej då går vi vidare till nästa del",
  "är det någon som har några frågor så här långt",
  "jag återkommer till det om en liten stund",
  "som jag sa tidigare är det här ganska intressant",
  "jag ska bara ta en klunk vatten",
];

interface Variant {
  vec: ArrayLike<number>;
  base: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export class DeckScorer {
  private variants = new Map<string, Variant[]>(); // target id -> embedded text and cues
  private keywords = new Map<string, KeywordTarget[]>(); // slide id -> keyword lists

  constructor(
    private deck: Deck,
    private embedder: Embedder | null,
    private useCues: boolean,
  ) {}

  get usesEmbeddings(): boolean {
    return this.embedder !== null;
  }

  /** P0-3/P4-3: embed every title/bullet (and cue) once, up front. */
  async prepare(): Promise<void> {
    const entries: { targetId: string; text: string }[] = [];
    for (const slide of this.deck.slides) {
      const targets = emphasisTargets(slide).map((t) => ({
        id: t.id,
        texts: this.useCues ? [t.text, ...t.cues] : [t.text],
      }));
      this.keywords.set(slide.id, buildKeywordTargets(targets));
      for (const t of targets) for (const text of t.texts) entries.push({ targetId: t.id, text });
    }
    if (!this.embedder) return;

    const vecs = await this.embedder.embed([...NEUTRAL, ...entries.map((e) => e.text)]);
    const neutralVecs = vecs.slice(0, NEUTRAL.length);
    entries.forEach((entry, i) => {
      const vec = vecs[NEUTRAL.length + i];
      const base = Math.max(...neutralVecs.map((n) => cosine(vec, n)));
      const list = this.variants.get(entry.targetId) ?? [];
      list.push({ vec, base });
      this.variants.set(entry.targetId, list);
    });
  }

  /**
   * Score every target on a slide against two views of the transcript:
   * `recent` (the last couple of seconds) and `full` (a longer window).
   * Recent words count more, so the highlight can move on while the old point is still in the long window.
   */
  async score(slideId: string, recent: string, full: string, w: ScoreWeights): Promise<ScoreRow[]> {
    const targets = this.keywords.get(slideId) ?? [];
    const windows = [recent, full];
    const share = [w.recentWeight, 1 - w.recentWeight];

    let windowVecs: (ArrayLike<number> | null)[] = [null, null];
    if (this.embedder) {
      const wanted = windows.map((text) => tokenize(text).length >= 2);
      const texts = windows.filter((_, i) => wanted[i]);
      const vecs = texts.length ? await this.embedder.embed(texts) : [];
      let next = 0;
      windowVecs = wanted.map((ok) => (ok ? vecs[next++] : null));
    }
    const windowTokens = windows.map(contentTokens);

    return targets.map((target) => {
      let emb = 0;
      let kw = 0;
      windows.forEach((_, i) => {
        const vec = windowVecs[i];
        const e = vec
          ? Math.max(
              0,
              ...(this.variants.get(target.id) ?? []).map((v) => clamp01((cosine(vec, v.vec) - v.base) / (1 - v.base))),
            )
          : 0;
        emb += share[i] * e;
        kw += share[i] * keywordScore(target, windowTokens[i]);
      });
      const score = this.embedder ? w.embWeight * emb + (1 - w.embWeight) * kw : kw;
      return { id: target.id, emb, kw, score };
    });
  }
}
